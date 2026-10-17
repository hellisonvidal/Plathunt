import { useEffect, useState } from "react";
import { persistSet } from "./persist";
import type { Title } from "../psn/types";

/**
 * Convocação de boost: o jogador escolhe um jogo e chama gente para fazer
 * junto os troféus online (ou de cooperativo). A PSN não deixa outros apps
 * mandarem mensagens, então a convocação vira um texto pronto para enviar
 * no WhatsApp, Telegram, Discord ou nas mensagens da PSN, e fica salva aqui.
 */

export const BOOST_WHEN = ["Agora", "Hoje à noite", "Amanhã", "Fim de semana", "A combinar"] as const;

export interface Boost {
  id: string;
  game: { id: string; name: string; platform: string; iconUrl: string | null };
  /** Quantos jogadores faltam. */
  players: number;
  when: string;
  /** Troféus que precisam de boost (nomes). */
  trophies: string[];
  note: string;
  createdAt: string;
  /** Amigos (onlineId) que já toparam. */
  joined: string[];
  done: boolean;
}

const KEY = "tm.boosts" as const;
const listeners = new Set<() => void>();

export function getBoosts(): Boost[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((b): b is Boost => !!b && typeof b === "object" && typeof b.id === "string" && !!b.game?.name)
      : [];
  } catch {
    return [];
  }
}

function save(list: Boost[]) {
  persistSet(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export function addBoost(b: Omit<Boost, "id" | "createdAt" | "joined" | "done">, now = new Date()): Boost {
  const boost: Boost = { ...b, id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: now.toISOString(), joined: [], done: false };
  save([boost, ...getBoosts()]);
  return boost;
}

export function updateBoost(id: string, patch: Partial<Pick<Boost, "joined" | "done">>) {
  save(getBoosts().map((b) => (b.id === id ? { ...b, ...patch } : b)));
}

export function removeBoost(id: string) {
  save(getBoosts().filter((b) => b.id !== id));
}

export function useBoosts(): Boost[] {
  const [list, setList] = useState(getBoosts);
  useEffect(() => {
    const sync = () => setList(getBoosts());
    listeners.add(sync);
    return () => void listeners.delete(sync);
  }, []);
  return list;
}

/** Texto da convocação, pronto para colar em qualquer conversa. */
export function boostMessage(b: Pick<Boost, "game" | "players" | "when" | "trophies" | "note">, me: string): string {
  const lines = [
    `📣 BOOST: ${b.game.name} (${b.game.platform})`,
    `👥 Procuro ${b.players} ${b.players === 1 ? "jogador" : "jogadores"} · 🕒 ${b.when}`,
  ];
  if (b.trophies.length) lines.push(`🏆 Troféus: ${b.trophies.join(", ")}`);
  if (b.note.trim()) lines.push(`📝 ${b.note.trim()}`);
  lines.push(`🎮 Me chama na PSN: ${me}`);
  return lines.join("\n");
}

/** Nome comparável entre versões (PS4/PS5, ™, maiúsculas). */
export const normalizeGameName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[™®©]/g, "")
    .replace(/\b(ps4|ps5|playstation ?[45]|edition|edicao)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** O jogo do amigo é o mesmo da convocação (mesmo id ou mesmo nome em outra plataforma). */
export function sameGame(a: Pick<Title, "id" | "name">, b: Pick<Title, "id" | "name">): boolean {
  return a.id === b.id || normalizeGameName(a.name) === normalizeGameName(b.name);
}

/** Links para enviar o texto da convocação. */
export function shareLinks(text: string) {
  const t = encodeURIComponent(text);
  return {
    whatsapp: `https://wa.me/?text=${t}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent("https://www.playstation.com")}&text=${t}`,
  };
}
