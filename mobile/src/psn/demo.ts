import { feedItemsFromTrophies, sortFeed } from "../lib/feed";
import type { Counts, Profile, PsnClient, Title, TrophyRow, TrophyType } from "./types";

/** Dados de demonstração: permite ver o app funcionando sem conta PSN. */

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const counts = (platinum: number, gold: number, silver: number, bronze: number): Counts => ({ platinum, gold, silver, bronze });

const PROFILES: Record<string, Profile> = {
  me: { accountId: "demo-me", onlineId: "Kratos_BR", avatarUrl: null, aboutMe: "Caçador de platinas", isPlus: true, level: 412, earned: counts(23, 180, 520, 1900) },
  aloy: { accountId: "demo-aloy", onlineId: "Aloy_Hunter", avatarUrl: null, aboutMe: null, isPlus: true, level: 538, earned: counts(41, 260, 700, 2500) },
  ellie: { accountId: "demo-ellie", onlineId: "Ellie_TLOU", avatarUrl: null, aboutMe: null, isPlus: false, level: 233, earned: counts(9, 70, 210, 800) },
};

const GAMES: Record<string, Omit<Title, "progress" | "earned" | "lastUpdated">> = {
  gow: { id: "DEMO_GOW", service: "trophy2", name: "God of War Ragnarök", iconUrl: null, platform: "PS5", defined: counts(1, 6, 12, 17) },
  hfw: { id: "DEMO_HFW", service: "trophy2", name: "Horizon Forbidden West", iconUrl: null, platform: "PS5", defined: counts(1, 4, 13, 47) },
  tlou: { id: "DEMO_TLOU", service: "trophy", name: "The Last of Us Part II", iconUrl: null, platform: "PS4", defined: counts(1, 3, 12, 14) },
};

const TROPHIES: Record<string, [number, TrophyType, string, string][]> = {
  DEMO_GOW: [
    [0, "platinum", "Pai e Filho", "Obtenha todos os troféus"],
    [12, "gold", "Rainha das Valquírias", "Derrote Gná"],
    [5, "bronze", "Primeiros passos", "Conclua o prólogo"],
    [20, "silver", "Ferreiro", "Melhore uma arma ao máximo"],
  ],
  DEMO_HFW: [
    [0, "platinum", "Lenda de Horizon", "Obtenha todos os troféus"],
    [22, "silver", "Domadora de Máquinas", "Sobrescreva 20 tipos de máquinas"],
    [3, "bronze", "A caçada começa", "Abata sua primeira máquina"],
  ],
  DEMO_TLOU: [
    [0, "platinum", "Sobrevivente nato", "Obtenha todos os troféus"],
    [7, "gold", "Sobrevivente", "Conclua o jogo no modo Sobrevivente"],
    [2, "bronze", "Seattle", "Chegue a Seattle"],
  ],
};

// [perfil, jogo, progresso, conquistas, horas atrás da última, troféus ganhos: [id, horas atrás, raridade]]
const PLAYS: [string, string, number, Counts, number, [number, number, number][]][] = [
  ["me", "gow", 100, counts(1, 6, 12, 17), 2, [[0, 2, 6.8], [12, 28, 21], [5, 300, 96.1], [20, 120, 40.2]]],
  ["me", "tlou", 64, counts(0, 1, 7, 10), 30, [[7, 30, 11.4], [2, 400, 88]]],
  ["aloy", "hfw", 100, counts(1, 4, 13, 47), 1, [[0, 1, 3.2], [22, 26, 34.9], [3, 500, 97]]],
  ["aloy", "gow", 41, counts(0, 1, 4, 9), 50, [[5, 50, 96.1]]],
  ["ellie", "tlou", 88, counts(0, 3, 10, 12), 5, [[7, 5, 11.4], [2, 200, 88]]],
];

const keyOf = (accountId: string) =>
  Object.keys(PROFILES).find((k) => PROFILES[k].accountId === accountId || (accountId === "me" && k === "me")) ?? "me";

function titlesOf(profileKey: string): Title[] {
  return PLAYS.filter((p) => p[0] === profileKey).map(([, g, progress, earned, h]) => ({
    ...GAMES[g],
    progress,
    earned,
    lastUpdated: hoursAgo(h),
  }));
}

function trophiesOf(profileKey: string, gameId: string): TrophyRow[] {
  const play = PLAYS.find((p) => p[0] === profileKey && GAMES[p[1]].id === gameId);
  const earned = new Map((play?.[5] ?? []).map(([id, h, rate]) => [id, { h, rate }]));
  return (TROPHIES[gameId] ?? []).map(([id, type, name, detail]) => {
    const e = earned.get(id);
    return {
      id,
      type,
      name,
      detail,
      iconUrl: null,
      hidden: false,
      groupId: "default",
      earned: !!e,
      earnedAt: e ? hoursAgo(e.h) : null,
      rate: e?.rate ?? null,
    };
  });
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));

export function createDemoClient(): PsnClient {
  return {
    me: () => delay(PROFILES.me),
    profile: (accountId) => delay(PROFILES[keyOf(accountId)]),
    titles: (accountId) => delay(titlesOf(keyOf(accountId))),
    gameTrophies: (accountId, game) => delay(trophiesOf(keyOf(accountId), game.id)),
    friends: () => delay([PROFILES.aloy, PROFILES.ellie]),
    feed: () => {
      const now = Date.now();
      const items = Object.keys(PROFILES).flatMap((k) => {
        const p = PROFILES[k];
        const owner = { accountId: p.accountId, onlineId: p.onlineId, avatarUrl: p.avatarUrl, isMe: k === "me" };
        return titlesOf(k).flatMap((title) => feedItemsFromTrophies({ owner, title }, trophiesOf(k, title.id), now));
      });
      return delay(sortFeed(items));
    },
  };
}
