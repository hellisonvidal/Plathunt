import { useEffect, useState } from "react";
import type { Boost } from "./boost";
import { answerBoostRequest, myBoostRequests } from "./cloud";
import { persistSet } from "./persist";

/**
 * Pedidos de boost recebidos de outros jogadores. Sem servidor, o pedido
 * viaja dentro da própria mensagem (WhatsApp, Telegram…) como um link
 * trophymania://boost?d=…: tocar no link abre o app, ou dá para colar a
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

const LINK = "trophymania://boost?d=";
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
  const code = text.match(/trophymania:\/\/boost\?d=([A-Za-z0-9_-]+)/)?.[1];
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
  const found = list.find((r) => r.id === id);
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

export function removeFromInbox(id: string) {
  const list = getInbox();
  const found = list.find((r) => r.id === id);
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
  const known = new Set(list.map((r) => r.cloudId).filter(Boolean));
  const added: ReceivedBoost[] = [];
  for (const r of received) {
    if (known.has(r.id) || r.status === "recusado") continue;
    const p = r.payload as Partial<Payload>;
    if (!p.game?.name) continue;
    added.push({
      id: `cloud:${r.id}`,
      cloudId: r.id,
      from: String(p.from ?? ""),
      game: { id: String(p.game.id ?? ""), name: String(p.game.name), platform: String(p.game.platform ?? ""), iconUrl: null },
      trophies: Array.isArray(p.trophies) ? p.trophies.map(String) : [],
      players: Number(p.players) || 1,
      when: String(p.when ?? ""),
      note: String(p.note ?? ""),
      createdAt: r.created_at,
      receivedAt: now.toISOString(),
      status: r.status === "aceito" ? "aceito" : "novo",
    });
  }
  if (added.length) save([...added, ...list]);
  return added;
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
