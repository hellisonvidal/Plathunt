import { useEffect, useState } from "react";
import type { TrophyRow } from "../psn/types";

/**
 * Jogos com multiplayer (para o Boost). A PSN e a PlayStation Store não dizem
 * se um jogo tem modo online; o que dá para saber é se ele tem troféus de
 * multiplayer: online, cooperativo, partidas, ranqueadas… Esses são justamente
 * os troféus que precisam de boost. O app lê a lista de troféus de cada jogo
 * (em segundo plano) e guarda a resposta no celular.
 */
const MULTIPLAYER = new RegExp(
  [
    "online", "on-line", "multiplayer", "multi-player", "multijogador", "multijugador", "multijoueur",
    "mehrspieler", "multigiocatore", "\\bco-?op\\b", "cooperativ", "coopérati", "\\bkoop", "\\bversus\\b",
    "\\bpvp\\b", "\\branked\\b", "ranqueada", "clasificatoria", "en ligne", "in linea",
    "オンライン", "マルチ", "協力", "対戦",
  ].join("|"),
  "i",
);

export function hasMultiplayerTrophies(trophies: Pick<TrophyRow, "name" | "detail" | "originalName">[]): boolean {
  return trophies.some((t) => MULTIPLAYER.test(`${t.originalName ?? ""} ${t.name} ${t.detail ?? ""}`));
}

const KEY = "tm.multiplayer";
let memo: Record<string, boolean> | null = null;
const listeners = new Set<() => void>();

function read(): Record<string, boolean> {
  if (memo) return memo;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    memo = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    memo = {};
  }
  return memo!;
}

/** true/false quando o jogo já foi verificado; undefined se ainda não. */
export function knownMultiplayer(titleId: string): boolean | undefined {
  return read()[titleId];
}

function remember(titleId: string, value: boolean) {
  memo = { ...read(), [titleId]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(memo));
  } catch {}
}

let scanning = false;
const queue: { id: string; load: () => Promise<Pick<TrophyRow, "name" | "detail" | "originalName">[]> }[] = [];
let checked = 0;

/** Põe jogos na fila de verificação (os já verificados são ignorados). */
export function scanMultiplayer(games: { id: string; load: () => Promise<Pick<TrophyRow, "name" | "detail" | "originalName">[]> }[]) {
  const queued = new Set(queue.map((q) => q.id));
  for (const g of games) if (knownMultiplayer(g.id) === undefined && !queued.has(g.id)) queue.push(g);
  if (!scanning) void run();
}

async function run() {
  scanning = true;
  let lastNotify = 0;
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        remember(job.id, hasMultiplayerTrophies(await job.load()));
      } catch {
        // Falhou agora: tenta de novo numa próxima vez.
      }
      checked++;
      if (Date.now() - lastNotify > 500) {
        lastNotify = Date.now();
        listeners.forEach((l) => l());
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  scanning = false;
  listeners.forEach((l) => l());
}

/** Re-renderiza enquanto a verificação anda; devolve quantos jogos faltam. */
export function useMultiplayerScan(): { pending: number; scanning: boolean } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const sync = () => setTick((n) => n + 1);
    listeners.add(sync);
    return () => void listeners.delete(sync);
  }, []);
  return { pending: queue.length + (scanning ? 1 : 0), scanning };
}

/** Para os testes. */
export function resetMultiplayer() {
  memo = null;
  queue.length = 0;
  checked = 0;
}
