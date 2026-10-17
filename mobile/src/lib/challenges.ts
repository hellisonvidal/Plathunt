import { useEffect, useState } from "react";
import { normalizeGameName } from "./boost";
import { locale, t } from "../i18n";
import { persistSet } from "./persist";
import type { Title, TrophyRow, TrophyType } from "../psn/types";

/**
 * Desafios: o jogador fixa um objetivo (um troféu de um jogo) e escolhe quem
 * participa; vence quem conquistar o troféu primeiro depois do início do
 * desafio (e dentro do prazo, se houver). As posições vêm das datas de
 * conquista na PSN e ficam salvas no celular (também alimentam os Méritos).
 */

export const CHALLENGE_DEADLINES = [
  { days: null, label: "Sem prazo" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
] as const;

/**
 * Objetivo "platina do jogo", para jogos sem lista de troféus conhecida (da
 * PlayStation Store): vale a platina de cada jogador, seja qual for o id.
 */
export const PLATINUM_GOAL = -1;

export function platinumGoal(): Challenge["trophy"] {
  return { id: PLATINUM_GOAL, name: t("Platina do jogo"), detail: t("Conquiste a platina"), type: "platinum", iconUrl: null, rate: null };
}

export interface ChallengePlayer {
  /** "me" para você. */
  accountId: string;
  onlineId: string;
  avatarUrl: string | null;
}

export type PlayerStatus = "venceu" | "conquistou" | "pendente" | "ja-tinha" | "fora-do-prazo" | "sem-jogo" | "privado";

export interface PlayerResult {
  status: PlayerStatus;
  earnedAt: string | null;
  /** Posição entre quem conquistou no desafio (1 = primeiro). */
  position: number | null;
}

export interface Challenge {
  id: string;
  createdAt: string;
  deadline: string | null;
  game: { name: string; iconUrl: string | null; titleId: string; service: Title["service"]; platform: string };
  trophy: { id: number; name: string; detail: string | null; type: TrophyType; iconUrl: string | null; rate: number | null };
  players: ChallengePlayer[];
  /** Última apuração, por accountId. */
  results: Record<string, PlayerResult>;
  checkedAt: string | null;
}

const KEY = "tm.challenges" as const;
const listeners = new Set<() => void>();

export function getChallenges(): Challenge[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter(
          (c): c is Challenge =>
            !!c && typeof c === "object" && typeof c.id === "string" && !!c.game?.name && !!c.trophy && Array.isArray(c.players),
        )
      : [];
  } catch {
    return [];
  }
}

function save(list: Challenge[]) {
  persistSet(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export function addChallenge(
  c: Pick<Challenge, "game" | "trophy" | "players">,
  deadlineDays: number | null,
  now = new Date(),
): Challenge {
  const challenge: Challenge = {
    ...c,
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now.toISOString(),
    deadline: deadlineDays ? new Date(now.getTime() + deadlineDays * 86_400_000).toISOString() : null,
    results: {},
    checkedAt: null,
  };
  save([challenge, ...getChallenges()]);
  return challenge;
}

export function saveResults(id: string, results: Record<string, PlayerResult>, now = new Date()) {
  save(getChallenges().map((c) => (c.id === id ? { ...c, results, checkedAt: now.toISOString() } : c)));
}

export function removeChallenge(id: string) {
  save(getChallenges().filter((c) => c.id !== id));
}

export function useChallenges(): Challenge[] {
  const [list, setList] = useState(getChallenges);
  useEffect(() => {
    const sync = () => setList(getChallenges());
    listeners.add(sync);
    return () => void listeners.delete(sync);
  }, []);
  return list;
}

/**
 * O troféu do desafio na lista de um jogador. Na mesma versão do jogo vale o
 * id; em outra versão (PS4 × PS5) procura pelo nome.
 */
export function findTrophy(trophies: TrophyRow[], target: Challenge["trophy"], sameVersion: boolean): TrophyRow | null {
  if (target.id === PLATINUM_GOAL) return trophies.find((t) => t.type === "platinum") ?? null;
  if (sameVersion) return trophies.find((t) => t.id === target.id) ?? null;
  const name = normalizeGameName(target.name);
  return (
    trophies.find((t) => normalizeGameName(t.originalName ?? t.name) === name || normalizeGameName(t.name) === name) ??
    trophies.find((t) => t.id === target.id && t.type === target.type) ??
    null
  );
}

/** Raw → resultado: o primeiro a conquistar depois do início (e no prazo) vence. */
export function rankChallenge(
  challenge: Pick<Challenge, "createdAt" | "deadline">,
  raw: Record<string, { earnedAt: string | null } | "sem-jogo" | "privado">,
): Record<string, PlayerResult> {
  const start = Date.parse(challenge.createdAt);
  const end = challenge.deadline ? Date.parse(challenge.deadline) : Infinity;
  const out: Record<string, PlayerResult> = {};
  const finishers: [string, number][] = [];
  for (const [id, r] of Object.entries(raw)) {
    if (r === "sem-jogo" || r === "privado") {
      out[id] = { status: r, earnedAt: null, position: null };
      continue;
    }
    const at = r.earnedAt ? Date.parse(r.earnedAt) : NaN;
    if (!Number.isFinite(at)) out[id] = { status: "pendente", earnedAt: null, position: null };
    else if (at < start) out[id] = { status: "ja-tinha", earnedAt: r.earnedAt, position: null };
    else if (at > end) out[id] = { status: "fora-do-prazo", earnedAt: r.earnedAt, position: null };
    else finishers.push([id, at]);
  }
  finishers
    .sort((a, b) => a[1] - b[1])
    .forEach(([id, at], i) => {
      out[id] = { status: i === 0 ? "venceu" : "conquistou", earnedAt: new Date(at).toISOString(), position: i + 1 };
    });
  return out;
}

/** Encerrado: prazo vencido ou todos já têm uma situação final. */
export function isFinished(c: Challenge, now = Date.now()): boolean {
  if (c.deadline && Date.parse(c.deadline) < now) return true;
  // Quem ainda não conquistou, não tem o jogo ou está privado pode mudar: o desafio segue aberto.
  const final = new Set<PlayerStatus>(["venceu", "conquistou", "ja-tinha", "fora-do-prazo"]);
  const results = c.players.map((p) => c.results[p.accountId]);
  return results.every((r) => r && final.has(r.status));
}

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  venceu: "🥇 Venceu",
  conquistou: "Conquistou",
  pendente: "Ainda não conquistou",
  "ja-tinha": "Já tinha antes do desafio",
  "fora-do-prazo": "Conquistou fora do prazo",
  "sem-jogo": "Não tem o jogo",
  privado: "Troféus privados",
};

/** Texto para chamar os amigos para o desafio. */
export function challengeMessage(c: Challenge, me: string): string {
  const lines = [
    t("🏁 DESAFIO: quem conquista primeiro \"{trophy}\"?", { trophy: c.trophy.name }),
    `🎮 ${c.game.name} (${c.game.platform})`,
  ];
  if (c.trophy.detail) lines.push(`📜 ${c.trophy.detail}`);
  lines.push(
    c.deadline
      ? t("⏳ Prazo: {date}", { date: new Date(c.deadline).toLocaleDateString(locale()) })
      : t("⏳ Sem prazo"),
  );
  lines.push(`👥 ${c.players.map((p) => p.onlineId).join(", ")}`);
  lines.push(t("Desafio criado por {me} no Trophy Mania", { me }));
  return lines.join("\n");
}

/** Números dos seus desafios, usados pelos Méritos (categoria Desafios). */
export interface ChallengeStats {
  created: number;
  wins: number;
  podiums: number;
  /** Desafios em que você conquistou o troféu no prazo. */
  completed: number;
  /** Amigos diferentes que você já desafiou. */
  rivals: number;
  /** Amigos diferentes que terminaram atrás de você (ou não conquistaram) num desafio que você venceu. */
  defeated: number;
  platinumWins: number;
  goldWins: number;
  /** Maior sequência de vitórias seguidas (desafios encerrados, em ordem). */
  bestStreak: number;
  /** Jogos diferentes em que você venceu. */
  gamesWon: number;
  /** Vitória mais rápida, em horas desde o início do desafio (null sem vitórias). */
  fastestWinHours: number | null;
  /** Vitórias em desafios com 5 ou mais jogadores. */
  bigWins: number;
  /** Vitórias por troféus com menos de 5% dos jogadores. */
  rareWins: number;
  /** Desafios com prazo em que você conquistou dentro do prazo. */
  onTime: number;
}

export function challengeStats(list: Challenge[], now = Date.now()): ChallengeStats {
  const mine = (c: Challenge) => c.results.me;
  const won = list.filter((c) => mine(c)?.status === "venceu");
  const hours = won.map((c) => (Date.parse(mine(c)!.earnedAt!) - Date.parse(c.createdAt)) / 3_600_000);
  let best = 0;
  let streak = 0;
  for (const c of [...list].filter((c) => isFinished(c, now) || mine(c)?.position).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    streak = mine(c)?.status === "venceu" ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  const rivals = new Set(list.flatMap((c) => c.players.filter((p) => p.accountId !== "me").map((p) => p.accountId)));
  const defeated = new Set(
    won.flatMap((c) =>
      c.players.filter((p) => p.accountId !== "me" && c.results[p.accountId]?.status !== "sem-jogo").map((p) => p.accountId),
    ),
  );
  return {
    created: list.length,
    wins: won.length,
    podiums: list.filter((c) => (mine(c)?.position ?? 99) <= 3).length,
    completed: list.filter((c) => mine(c)?.position).length,
    rivals: rivals.size,
    defeated: defeated.size,
    platinumWins: won.filter((c) => c.trophy.type === "platinum").length,
    goldWins: won.filter((c) => c.trophy.type === "gold").length,
    bestStreak: best,
    gamesWon: new Set(won.map((c) => normalizeGameName(c.game.name))).size,
    fastestWinHours: hours.length ? Math.min(...hours) : null,
    bigWins: won.filter((c) => c.players.length >= 5).length,
    rareWins: won.filter((c) => c.trophy.rate !== null && c.trophy.rate < 5).length,
    onTime: list.filter((c) => c.deadline && mine(c)?.position).length,
  };
}
