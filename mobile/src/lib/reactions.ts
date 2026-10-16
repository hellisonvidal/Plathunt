import { useCallback, useEffect, useState } from "react";
import { persistRemove, persistSet } from "./persist";

/**
 * Reações às conquistas. Sem servidor, ficam salvas só neste celular (os
 * amigos não veem). Os ids "ps:*" são os botões do controle PlayStation.
 */
export const STANDARD_REACTIONS = ["👍", "❤️", "🔥", "👏", "😮", "😂", "🎉", "💪"] as const;
export const PLAYSTATION_REACTIONS = ["ps:triangle", "ps:circle", "ps:cross", "ps:square", "🎮", "🏆"] as const;
const ALL = new Set<string>([...STANDARD_REACTIONS, ...PLAYSTATION_REACTIONS]);

const KEY = "tm.reactions" as const;
const listeners = new Set<() => void>();

function readAll(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Liga/desliga uma reação; devolve a nova lista daquele item. */
export function toggleReaction(itemKey: string, reaction: string): string[] {
  if (!ALL.has(reaction)) return readAll()[itemKey] ?? [];
  const all = readAll();
  const current = all[itemKey] ?? [];
  const next = current.includes(reaction) ? current.filter((r) => r !== reaction) : [...current, reaction];
  if (next.length) all[itemKey] = next;
  else delete all[itemKey];
  persistSet(KEY, JSON.stringify(all));
  listeners.forEach((l) => l());
  return next;
}

export function clearReactions() {
  persistRemove(KEY);
  listeners.forEach((l) => l());
}

export function useReactions(itemKey: string) {
  const [mine, setMine] = useState<string[]>(() => readAll()[itemKey] ?? []);
  useEffect(() => {
    const sync = () => setMine(readAll()[itemKey] ?? []);
    listeners.add(sync);
    return () => void listeners.delete(sync);
  }, [itemKey]);
  const toggle = useCallback((r: string) => setMine(toggleReaction(itemKey, r)), [itemKey]);
  return { mine, toggle };
}

/** Quantas conquistas o usuário já curtiu (para os Méritos). */
export function countReactedItems(): number {
  return Object.keys(readAll()).length;
}
