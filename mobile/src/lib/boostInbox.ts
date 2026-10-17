import { useEffect, useState } from "react";
import type { Boost } from "./boost";
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
  save(getInbox().map((r) => (r.id === id ? { ...r, status } : r)));
}

export function removeFromInbox(id: string) {
  save(getInbox().filter((r) => r.id !== id));
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
