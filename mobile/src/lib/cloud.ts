import { useEffect, useState } from "react";
import { getAccessToken } from "../psn/auth";
import { persistRemove, persistSet } from "./persist";

/**
 * Recursos online (opcionais, ligados em Configurações): curtidas que o dono
 * da conquista vê e pedidos de boost que chegam direto no app do amigo. O
 * servidor é um Cloudflare Worker (pasta cloudflare/), que confirma o ID da
 * PSN com o token da sessão PSN do próprio usuário e devolve uma sessão
 * assinada; cada rota só mexe nos dados de quem está logado.
 *
 * O endereço vem do build (VITE_CLOUD_URL); sem ele, os recursos online ficam
 * indisponíveis e o resto do app funciona normalmente.
 */
const API = (import.meta.env.VITE_CLOUD_URL ?? "").replace(/\/+$/, "");
const SESSION_KEY = "tm.cloud" as const;
export const PRIVACY_URL = "https://github.com/hellisonvidal/Plathunt/blob/main/docs/privacidade.md";

/** Este build sabe o endereço do servidor dos recursos online. */
export const cloudAvailable = () => API !== "";

/** Endereço do servidor (para os links de convite que abrem o app). */
export const cloudUrl = () => API;

export interface CloudIdentity {
  accountId: string;
  onlineId: string;
}

interface StoredSession extends CloudIdentity {
  token: string;
  /** Validade (ms desde 1970). */
  expiresAt: number;
}

function loadSession(): StoredSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as StoredSession | null;
    // Sessões antigas (do Supabase) não têm `token`: o app conecta de novo.
    if (!s || typeof s.token !== "string" || typeof s.expiresAt !== "number") return null;
    return s.expiresAt - Date.now() > 60_000 ? s : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
const notifyChange = () => listeners.forEach((l) => l());

/** Quem está conectado aos recursos online (null se desligado). */
export async function cloudIdentity(): Promise<CloudIdentity | null> {
  if (!cloudAvailable()) return null;
  const s = loadSession();
  return s ? { accountId: s.accountId, onlineId: s.onlineId } : null;
}

class CloudError extends Error {
  constructor(readonly status: number) {
    super(`Servidor dos recursos online respondeu ${status}.`);
  }
}

async function post<T>(path: string, body: unknown, token?: string, method = "POST"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new CloudError(res.status);
  return (await res.json()) as T;
}

/** Liga os recursos online: confirma o ID da PSN no servidor e guarda a sessão. */
export async function connectCloud(): Promise<CloudIdentity> {
  if (!cloudAvailable()) throw new Error("Recursos online indisponíveis nesta versão.");
  const psnToken = await getAccessToken();
  const data = await post<StoredSession>("/v1/login", { psnToken });
  if (!data?.token) throw new Error("Não foi possível confirmar sua conta PSN.");
  const session: StoredSession = {
    token: data.token,
    accountId: String(data.accountId),
    onlineId: String(data.onlineId),
    expiresAt: Number(data.expiresAt),
  };
  persistSet(SESSION_KEY, JSON.stringify(session));
  notifyChange();
  return { accountId: session.accountId, onlineId: session.onlineId };
}

/** Desliga os recursos online neste celular. */
export async function disconnectCloud(): Promise<void> {
  persistRemove(SESSION_KEY);
  notifyChange();
}

/**
 * Chamada autenticada. Se a sessão venceu ou foi recusada, confirma a conta
 * na PSN de novo (uma vez) e repete; sem conexão, o erro segue normal.
 */
async function api<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  let session = loadSession();
  if (!session) {
    await connectCloud();
    session = loadSession();
    if (!session) throw new CloudError(401);
  }
  try {
    return await post<T>(path, body, session.token, method);
  } catch (e) {
    if (!(e instanceof CloudError) || e.status !== 401) throw e;
    persistRemove(SESSION_KEY);
    await connectCloud();
    const fresh = loadSession();
    if (!fresh) throw e;
    return post<T>(path, body, fresh.token, method);
  }
}

/** Apaga do servidor tudo o que ele guarda sobre você e desliga os recursos online. */
export async function deleteCloudData(): Promise<void> {
  await api("/v1/account/delete", {});
  await disconnectCloud();
}

/** Estado da conexão para as telas. */
export function useCloud(): { identity: CloudIdentity | null; ready: boolean } {
  const [state, setState] = useState<{ identity: CloudIdentity | null; ready: boolean }>({ identity: null, ready: false });
  useEffect(() => {
    let alive = true;
    const sync = () => void cloudIdentity().then((id) => alive && setState({ identity: id, ready: true }));
    sync();
    listeners.add(sync);
    return () => {
      alive = false;
      listeners.delete(sync);
    };
  }, []);
  return state;
}

// ---------------------------------------------------------------------------
// Curtidas

export interface CloudLike {
  item_key: string;
  owner_account_id: string;
  liker_account_id: string;
  reaction: string;
  created_at: string;
}

/** Envia (ou desfaz) uma curtida para o dono da conquista ver. */
export async function syncLike(itemKey: string, ownerAccountId: string, reaction: string, on: boolean): Promise<void> {
  const me = await cloudIdentity();
  if (!me || ownerAccountId === me.accountId) return;
  await api("/v1/likes", { item_key: itemKey, owner_account_id: ownerAccountId, reaction, on });
}

/** Curtidas de todos os usuários do app nestas conquistas. */
export async function likesFor(itemKeys: string[]): Promise<CloudLike[]> {
  if (!itemKeys.length || !(await cloudIdentity())) return [];
  const { likes } = await api<{ likes: CloudLike[] }>("/v1/likes/query", { keys: itemKeys.slice(0, 100) });
  return likes;
}

/** Curtidas que os outros deram nas suas conquistas desde `since`. */
export async function likesOnMine(since: string): Promise<(CloudLike & { online_id: string | null })[]> {
  if (!(await cloudIdentity())) return [];
  const { likes } = await api<{ likes: (CloudLike & { online_id: string | null })[] }>(
    `/v1/likes/mine?since=${encodeURIComponent(since)}`,
    undefined,
    "GET",
  );
  return likes;
}

/** Nomes (onlineId) dos usuários do app, por accountId. */
export async function appUsers(accountIds: string[]): Promise<Map<string, string>> {
  const ids = accountIds.filter((id) => /^\d{1,32}$/.test(id));
  if (!ids.length || !(await cloudIdentity())) return new Map();
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { profiles } = await api<{ profiles: { account_id: string; online_id: string }[] }>("/v1/profiles", {
      ids: ids.slice(i, i + 200),
    });
    for (const p of profiles) out.set(p.account_id, p.online_id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pedidos de boost direto no app

export interface CloudBoostRequest {
  id: string;
  from_account_id: string;
  to_account_id: string;
  payload: Record<string, unknown>;
  status: "novo" | "aceito" | "recusado";
  created_at: string;
  /** Nome na PSN de quem enviou, confirmado pelo servidor (não o que veio no pedido). */
  from_online_id?: string | null;
}

/** Envia o pedido para amigos que usam o app. */
export async function sendBoostRequests(toAccountIds: string[], payload: Record<string, unknown>): Promise<number> {
  const me = await cloudIdentity();
  if (!me || !toAccountIds.length) return 0;
  const { count } = await api<{ count: number }>("/v1/boosts", { to: toAccountIds, payload });
  return count;
}

/** Pedidos recebidos (para mim) e respostas dos que enviei. */
export async function myBoostRequests(): Promise<{ received: CloudBoostRequest[]; sent: CloudBoostRequest[] }> {
  const me = await cloudIdentity();
  if (!me) return { received: [], sent: [] };
  const { requests } = await api<{ requests: CloudBoostRequest[] }>("/v1/boosts", undefined, "GET");
  return {
    received: requests.filter((r) => r.to_account_id === me.accountId),
    sent: requests.filter((r) => r.from_account_id === me.accountId),
  };
}

/** Guarda o convite no servidor e devolve o código do link curto (https://…/c/<código>). */
export async function createInvite(payload: Record<string, unknown>): Promise<string> {
  const { id } = await api<{ id: string }>("/v1/invites", { payload });
  return id;
}

export async function answerBoostRequest(id: string, status: "aceito" | "recusado"): Promise<void> {
  await api("/v1/boosts/answer", { id, status });
}
