import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getAccessToken } from "../psn/auth";
import { persistRemove, persistSet } from "./persist";

/**
 * Recursos online (opcionais, ligados em Configurações): curtidas que o dono
 * da conquista vê e pedidos de boost que chegam direto no app do amigo. Usa o
 * Supabase (plano gratuito). A identidade é o ID da PSN, confirmado pela
 * função psn-login com o token da sessão PSN do próprio usuário.
 */
const URL = "https://stewwpwwkhuegghgfjhr.supabase.co";
/** Chave pública (publishable): só permite o que as regras do banco (RLS) deixam. */
const PUBLISHABLE_KEY = "sb_publishable_KXvZdqxhcjZGrh8Txkfo5A_zr790wc9";
const SESSION_KEY = "tm.cloud" as const;
export const PRIVACY_URL = "https://github.com/hellisonvidal/Trophy-Mania/blob/main/docs/privacidade.md";

/** A sessão fica no localStorage e na cópia nativa (sobrevive a atualizações do app). */
const storage = {
  getItem: (key: string) => (key === SESSION_KEY ? localStorage.getItem(key) : null),
  setItem: (key: string, value: string) => {
    if (key === SESSION_KEY) persistSet(SESSION_KEY, value);
  },
  removeItem: (key: string) => {
    if (key === SESSION_KEY) persistRemove(SESSION_KEY);
  },
};

let client: SupabaseClient | null = null;
export function cloud(): SupabaseClient {
  client ??= createClient(URL, PUBLISHABLE_KEY, {
    auth: { storage, storageKey: SESSION_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

export interface CloudIdentity {
  accountId: string;
  onlineId: string;
}

let identity: CloudIdentity | null = null;
const listeners = new Set<() => void>();
const notifyChange = () => listeners.forEach((l) => l());

/** Quem está conectado aos recursos online (null se desligado). */
export async function cloudIdentity(): Promise<CloudIdentity | null> {
  if (identity) return identity;
  try {
    const { data } = await cloud().auth.getSession();
    const meta = data.session?.user.user_metadata as { account_id?: string; online_id?: string } | undefined;
    if (!data.session || !meta?.account_id) return null;
    identity = { accountId: meta.account_id, onlineId: meta.online_id ?? "" };
    return identity;
  } catch {
    return null;
  }
}

/** Liga os recursos online: confirma o ID da PSN no servidor e guarda a sessão. */
export async function connectCloud(): Promise<CloudIdentity> {
  const psnToken = await getAccessToken();
  const { data, error } = await cloud().functions.invoke("psn-login", { body: { psnToken } });
  if (error || !data?.accessToken) throw new Error("Não foi possível confirmar sua conta PSN.");
  const set = await cloud().auth.setSession({ access_token: data.accessToken, refresh_token: data.refreshToken });
  if (set.error) throw set.error;
  identity = { accountId: String(data.accountId), onlineId: String(data.onlineId) };
  notifyChange();
  return identity;
}

/** Desliga os recursos online neste celular. */
export async function disconnectCloud(): Promise<void> {
  try {
    await cloud().auth.signOut({ scope: "local" });
  } catch {}
  persistRemove(SESSION_KEY);
  identity = null;
  notifyChange();
}

/** Estado da conexão para as telas. */
export function useCloud(): { identity: CloudIdentity | null; ready: boolean } {
  const [state, setState] = useState<{ identity: CloudIdentity | null; ready: boolean }>({ identity, ready: !!identity });
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
  const likes = cloud().from("likes");
  if (on) {
    await likes.upsert(
      { item_key: itemKey, owner_account_id: ownerAccountId, liker_account_id: me.accountId, reaction },
      { onConflict: "item_key,liker_account_id,reaction", ignoreDuplicates: true },
    );
  } else {
    await likes.delete().match({ item_key: itemKey, liker_account_id: me.accountId, reaction });
  }
}

/** Curtidas de todos os usuários do app nestas conquistas. */
export async function likesFor(itemKeys: string[]): Promise<CloudLike[]> {
  if (!itemKeys.length || !(await cloudIdentity())) return [];
  const { data } = await cloud().from("likes").select("*").in("item_key", itemKeys.slice(0, 100));
  return (data as CloudLike[] | null) ?? [];
}

/** Curtidas que os outros deram nas suas conquistas desde `since`. */
export async function likesOnMine(since: string): Promise<(CloudLike & { online_id: string | null })[]> {
  const me = await cloudIdentity();
  if (!me) return [];
  const { data } = await cloud()
    .from("likes")
    .select("*, profiles!likes_liker_account_id_fkey(online_id)")
    .eq("owner_account_id", me.accountId)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  return ((data ?? []) as (CloudLike & { profiles: { online_id: string } | null })[]).map((l) => ({
    ...l,
    online_id: l.profiles?.online_id ?? null,
  }));
}

/** Nomes (onlineId) dos usuários do app, por accountId. */
export async function appUsers(accountIds: string[]): Promise<Map<string, string>> {
  if (!accountIds.length || !(await cloudIdentity())) return new Map();
  const out = new Map<string, string>();
  for (let i = 0; i < accountIds.length; i += 200) {
    const { data } = await cloud()
      .from("profiles")
      .select("account_id, online_id")
      .in("account_id", accountIds.slice(i, i + 200));
    for (const p of (data ?? []) as { account_id: string; online_id: string }[]) out.set(p.account_id, p.online_id);
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
}

/** Envia o pedido para amigos que usam o app. */
export async function sendBoostRequests(toAccountIds: string[], payload: Record<string, unknown>): Promise<number> {
  const me = await cloudIdentity();
  if (!me || !toAccountIds.length) return 0;
  const rows = toAccountIds.map((to) => ({ from_account_id: me.accountId, to_account_id: to, payload }));
  const { error } = await cloud().from("boost_requests").insert(rows);
  if (error) throw error;
  return rows.length;
}

/** Pedidos recebidos (para mim) e respostas dos que enviei. */
export async function myBoostRequests(): Promise<{ received: CloudBoostRequest[]; sent: CloudBoostRequest[] }> {
  const me = await cloudIdentity();
  if (!me) return { received: [], sent: [] };
  const { data } = await cloud().from("boost_requests").select("*").order("created_at", { ascending: false }).limit(100);
  const list = (data ?? []) as CloudBoostRequest[];
  return {
    received: list.filter((r) => r.to_account_id === me.accountId),
    sent: list.filter((r) => r.from_account_id === me.accountId),
  };
}

export async function answerBoostRequest(id: string, status: "aceito" | "recusado"): Promise<void> {
  const { error } = await cloud().from("boost_requests").update({ status }).eq("id", id);
  if (error) throw error;
}
