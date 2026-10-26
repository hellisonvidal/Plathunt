import { useEffect, useState } from "react";
import type { Boost } from "./boost";
import { answerBoostRequest, cloudIdentity, cloudUrl, createInvite, myBoostRequests } from "./cloud";
import { PLAY_STORE_URL } from "../psn/native";
import { t } from "../i18n";
import { persistSet } from "./persist";

/**
 * Pedidos de boost recebidos de outros jogadores. Sem servidor, o pedido
 * viaja dentro da própria mensagem (WhatsApp, Telegram…) como um link
 * plathunt://boost?d=…: tocar no link abre o app, ou dá para colar a
 * mensagem no painel "Pedidos recebidos".
 */
export interface ReceivedBoost {
  id: string;
  from: string;
  game: Boost["game"];
  trophies: string[];
  players: number;
  when: string;
  note: string;
  createdAt: string;
  receivedAt: string;
  status: "novo" | "aceito";
  /** Pedido que chegou pelos recursos online (id no servidor). */
  cloudId?: string;
}

type Payload = Pick<ReceivedBoost, "from" | "game" | "trophies" | "players" | "when" | "note" | "createdAt">;

const LINK = "plathunt://boost?d=";
const KEY = "tm.boostInbox" as const;
const listeners = new Set<() => void>();

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * Link de convite para mandar no WhatsApp (e outros): um endereço https, que
 * os apps de mensagem deixam tocar. A página abre o pedido no Plathunt ou,
 * sem o app instalado, leva para a Play Store. Sem o servidor dos recursos
 * online neste build, vai o link do app e o da Play Store.
 */
export function inviteLink(b: Pick<Boost, "game" | "trophies" | "players" | "when" | "note" | "createdAt">, from: string): string {
  const api = cloudUrl();
  return api ? `${api}/convite?d=${boostLink(b, from).slice(LINK.length)}` : boostLink(b, from);
}

/** Linhas do convite que vão no fim da mensagem: responder no app (ou instalar). */
export function inviteLines(
  b: Pick<Boost, "game" | "trophies" | "players" | "when" | "note" | "createdAt">,
  from: string,
  link = inviteLink(b, from),
): string {
  return link.startsWith("https://")
    ? t("👉 Topa? Responda no Plathunt: {link}", { link })
    : `🔗 ${t("Abrir no Plathunt")}: ${link}\n📲 ${t("Ainda não tem o Plathunt? Instale")}: ${PLAY_STORE_URL}`;
}

const SHORT_KEY = "tm.inviteLinks";

function shortLinks(): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(SHORT_KEY) ?? "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

/** Link curto já criado para este pedido (sem rede). */
export function savedShortLink(b: Pick<Boost, "id">): string | null {
  return shortLinks()[b.id] ?? null;
}

/**
 * Link curto do convite (https://…/c/Ab3dE9x), criado uma vez por pedido e
 * guardado. Sem os recursos online (ou sem rede), fica o link longo.
 */
export async function shortInviteLink(b: Boost, from: string): Promise<string> {
  const saved = savedShortLink(b);
  if (saved) return saved;
  const api = cloudUrl();
  if (!api || !(await cloudIdentity())) return inviteLink(b, from);
  try {
    const id = await createInvite({
      from,
      game: { ...b.game, iconUrl: null },
      trophies: b.trophies,
      players: b.players,
      when: b.when,
      note: b.note,
      createdAt: b.createdAt,
    });
    const link = `${api}/c/${id}`;
    const all = Object.entries({ ...shortLinks(), [b.id]: link }).slice(-200);
    try {
      localStorage.setItem(SHORT_KEY, JSON.stringify(Object.fromEntries(all)));
    } catch {}
    return link;
  } catch {
    return inviteLink(b, from);
  }
}

/**
 * Identidade do pedido: o mesmo pedido pode chegar pelo app (recursos
 * online) e pelo link do WhatsApp; os dois viram um só no painel.
 */
export function requestKey(p: Pick<ReceivedBoost, "from" | "createdAt" | "game">): string {
  return `${p.from.toLowerCase()}:${p.createdAt}:${p.game.name}`;
}

/** Link do pedido, que vai junto no texto da convocação. */
export function boostLink(b: Pick<Boost, "game" | "trophies" | "players" | "when" | "note" | "createdAt">, from: string): string {
  const payload: Payload = {
    from,
    game: { ...b.game, iconUrl: null },
    trophies: b.trophies,
    players: b.players,
    when: b.when,
    note: b.note,
    createdAt: b.createdAt,
  };
  return LINK + toBase64Url(JSON.stringify(payload));
}

/** Lê um pedido de um link ou de uma mensagem colada; null se não houver pedido válido. */
export function parseBoostText(text: string): Payload | null {
  // trophymania:// é o formato dos links enviados antes do nome Plathunt.
  const code = text.match(/(?:plathunt|trophymania):\/\/boost\?d=([A-Za-z0-9_-]+)/)?.[1];
  if (!code) return null;
  try {
    const p = JSON.parse(fromBase64Url(code)) as Payload;
    if (!p || typeof p.from !== "string" || !p.game?.name || !Array.isArray(p.trophies)) return null;
    return {
      from: p.from.slice(0, 32),
      game: { id: String(p.game.id ?? ""), name: String(p.game.name), platform: String(p.game.platform ?? ""), iconUrl: null },
      trophies: p.trophies.map(String).slice(0, 50),
      players: Math.max(1, Math.min(15, Number(p.players) || 1)),
      when: String(p.when ?? ""),
      note: String(p.note ?? "").slice(0, 300),
      createdAt: String(p.createdAt ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function getInbox(): ReceivedBoost[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === "string" && r.game?.name) : [];
  } catch {
    return [];
  }
}

function save(list: ReceivedBoost[]) {
  persistSet(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export type ImportResult = { ok: true; request: ReceivedBoost; duplicate: boolean } | { ok: false; reason: "invalido" | "meu" };

/**
 * Guarda um pedido recebido. Pedidos seus (mesmo ID da PSN) não entram: o
 * painel mostra só os pedidos de outros jogadores.
 */
export function importBoost(text: string, me: string | null, now = new Date()): ImportResult {
  const p = parseBoostText(text);
  if (!p) return { ok: false, reason: "invalido" };
  if (me && p.from.toLowerCase() === me.toLowerCase()) return { ok: false, reason: "meu" };
  const id = `${p.from}:${p.createdAt}:${p.game.name}`;
  const list = getInbox();
  // Já chegou pelo app (ou pelo mesmo link antes): não duplica.
  const found = list.find((r) => r.id === id || requestKey(r) === requestKey(p));
  if (found) return { ok: true, request: found, duplicate: true };
  const request: ReceivedBoost = { ...p, id, receivedAt: now.toISOString(), status: "novo" };
  save([request, ...list]);
  return { ok: true, request, duplicate: false };
}

export function setInboxStatus(id: string, status: ReceivedBoost["status"]) {
  const list = getInbox();
  const found = list.find((r) => r.id === id);
  save(list.map((r) => (r.id === id ? { ...r, status } : r)));
  if (found?.cloudId && status === "aceito") void answerBoostRequest(found.cloudId, "aceito").catch(() => {});
}

/** Pedidos online que o jogador apagou: não voltam na próxima sincronização. */
const DISMISSED_KEY = "tm.boostInboxDismissed" as const;

function getDismissed(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function removeFromInbox(id: string) {
  const list = getInbox();
  const found = list.find((r) => r.id === id);
  if (found?.cloudId) persistSet(DISMISSED_KEY, JSON.stringify([found.cloudId, ...getDismissed()].slice(0, 500)));
  // Recusar um pedido que veio pelo app avisa quem pediu.
  if (found?.cloudId && found.status === "novo") void answerBoostRequest(found.cloudId, "recusado").catch(() => {});
  save(list.filter((r) => r.id !== id));
}

/**
 * Traz os pedidos que chegaram pelos recursos online para o painel. Devolve
 * os novos (para avisar). Pedidos recusados ou já apagados não voltam.
 */
export async function syncCloudInbox(now = new Date()): Promise<ReceivedBoost[]> {
  const { received } = await myBoostRequests();
  const list = getInbox();
  const known = new Set([...list.map((r) => r.cloudId).filter(Boolean), ...getDismissed()]);
  const keys = new Set(list.map(requestKey));
  const added: ReceivedBoost[] = [];
  // O mesmo pedido que já chegou pelo link do WhatsApp: liga ao do app (para
  // a resposta sim/não chegar a quem pediu) em vez de duplicar.
  const linked = new Map<string, string>();
  for (const r of received) {
    if (known.has(r.id) || r.status === "recusado") continue;
    const p = r.payload as Partial<Payload>;
    if (!p.game?.name) continue;
    const from = r.from_online_id ?? String(p.from ?? "");
    // A data do pedido (a mesma que vai no link do WhatsApp), não a do envio.
    const createdAt = String(p.createdAt ?? r.created_at);
    const key = requestKey({ from, createdAt, game: { ...p.game, name: String(p.game.name) } as Boost["game"] });
    if (keys.has(key)) {
      linked.set(key, r.id);
      continue;
    }
    keys.add(key);
    added.push({
      id: `cloud:${r.id}`,
      cloudId: r.id,
      // O nome vem do perfil confirmado pela PSN, não do texto do pedido (que
      // quem envia poderia trocar para se passar por um amigo).
      from,
      game: { id: String(p.game.id ?? ""), name: String(p.game.name), platform: String(p.game.platform ?? ""), iconUrl: null },
      trophies: Array.isArray(p.trophies) ? p.trophies.map(String) : [],
      players: Number(p.players) || 1,
      when: String(p.when ?? ""),
      note: String(p.note ?? ""),
      createdAt,
      receivedAt: now.toISOString(),
      status: r.status === "aceito" ? "aceito" : "novo",
    });
  }
  const merged = linked.size
    ? list.map((r) => (!r.cloudId && linked.has(requestKey(r)) ? { ...r, cloudId: linked.get(requestKey(r)) } : r))
    : list;
  if (added.length || linked.size) save([...added, ...merged]);
  return added;
}

/** Respostas aos seus pedidos (sim/não) já avisadas. */
const ANSWERS_KEY = "tm.boostAnswersSeen" as const;

/**
 * Respostas novas (sim ou não) aos pedidos que você enviou pelo app, para
 * avisar. Na primeira vez só marca as que já existiam, sem avisar.
 */
export async function takeNewAnswers(): Promise<
  { id: string; toAccountId: string; status: "aceito" | "recusado"; game: string }[]
> {
  const { sent } = await myBoostRequests();
  let seen: string[] | null = null;
  try {
    const saved = JSON.parse(localStorage.getItem(ANSWERS_KEY) ?? "null");
    seen = Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : null;
  } catch {
    seen = null;
  }
  const answered = sent.filter((r) => r.status === "aceito" || r.status === "recusado");
  const fresh = seen ? answered.filter((r) => !seen!.includes(r.id)) : [];
  if (!seen || fresh.length)
    persistSet(ANSWERS_KEY, JSON.stringify([...new Set([...answered.map((r) => r.id), ...(seen ?? [])])].slice(0, 1000)));
  return fresh.map((r) => ({
    id: r.id,
    toAccountId: r.to_account_id,
    status: r.status as "aceito" | "recusado",
    game: String((r.payload as { game?: { name?: unknown } }).game?.name ?? ""),
  }));
}

/** O que vai para o servidor ao enviar um pedido direto no app. */
export function cloudPayload(b: Pick<Boost, "id" | "game" | "trophies" | "players" | "when" | "note" | "createdAt">, from: string) {
  return { boostId: b.id, from, game: { ...b.game, iconUrl: null }, trophies: b.trophies, players: b.players, when: b.when, note: b.note, createdAt: b.createdAt };
}

export function useInbox(): ReceivedBoost[] {
  const [list, setList] = useState(getInbox);
  useEffect(() => {
    const sync = () => setList(getInbox());
    listeners.add(sync);
    return () => void listeners.delete(sync);
  }, []);
  return list;
}
