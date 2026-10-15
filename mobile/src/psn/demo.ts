import { feedItemsFromTrophies, sortFeed } from "../lib/feed";
import { getSettings } from "../lib/settings";
import type { Counts, PlayedGame, Profile, PsnClient, Title, TrophyGroup, TrophyRow, TrophyType } from "./types";

/** Dados de demonstração: permite ver o app funcionando sem conta PSN. */

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const counts = (platinum: number, gold: number, silver: number, bronze: number): Counts => ({ platinum, gold, silver, bronze });

const PROFILES: Record<string, Profile> = {
  me: { accountId: "demo-me", onlineId: "Kratos_BR", avatarUrl: null, aboutMe: "Caçador de platinas", isPlus: true, level: 412, levelProgress: 63, earned: counts(23, 180, 520, 1900) },
  aloy: { accountId: "demo-aloy", onlineId: "Aloy_Hunter", avatarUrl: null, aboutMe: null, isPlus: true, level: 538, levelProgress: 12, earned: counts(41, 260, 700, 2500) },
  ellie: { accountId: "demo-ellie", onlineId: "Ellie_TLOU", avatarUrl: null, aboutMe: null, isPlus: false, level: 233, levelProgress: 88, earned: counts(9, 70, 210, 800) },
};

type GameDef = Omit<Title, "progress" | "earned" | "lastUpdated"> & { groups: TrophyGroup[] };
const group = (id: string, name: string, defined: Counts): TrophyGroup => ({ id, name, iconUrl: null, defined });

const GAMES: Record<string, GameDef> = {
  gow: {
    id: "DEMO_GOW", service: "trophy2", name: "God of War Ragnarök", iconUrl: null, platform: "PS5", defined: counts(1, 6, 13, 18), hasGroups: true,
    groups: [group("default", "God of War Ragnarök", counts(1, 6, 12, 17)), group("001", "God of War Ragnarök: Valhalla", counts(0, 0, 1, 1))],
  },
  hfw: {
    id: "DEMO_HFW", service: "trophy2", name: "Horizon Forbidden West", iconUrl: null, platform: "PS5", defined: counts(1, 5, 14, 48), hasGroups: true,
    groups: [group("default", "Horizon Forbidden West", counts(1, 4, 13, 47)), group("001", "Burning Shores", counts(0, 1, 1, 1))],
  },
  tlou: { id: "DEMO_TLOU", service: "trophy", name: "The Last of Us Part II", iconUrl: null, platform: "PS4", defined: counts(1, 3, 12, 14), hasGroups: false, groups: [] },
  bb: { id: "DEMO_BB", service: "trophy", name: "Bloodborne", iconUrl: null, platform: "PS4", defined: counts(1, 6, 15, 12), hasGroups: false, groups: [] },
  unch: { id: "DEMO_UNCH", service: "trophy", name: "Uncharted 2: Among Thieves", iconUrl: null, platform: "PS3", defined: counts(1, 4, 12, 40), hasGroups: false, groups: [] },
  grav: { id: "DEMO_GRAV", service: "trophy", name: "Gravity Rush", iconUrl: null, platform: "PSVITA", defined: counts(1, 2, 8, 37), hasGroups: false, groups: [] },
  spidey: { id: "DEMO_SPIDEY", service: "trophy2", name: "Marvel's Spider-Man 2", iconUrl: null, platform: "PS5", defined: counts(1, 4, 10, 27), hasGroups: false, groups: [] },
  astro: { id: "DEMO_ASTRO", service: "trophy2", name: "Astro Bot", iconUrl: null, platform: "PS5", defined: counts(1, 5, 10, 29), hasGroups: false, groups: [] },
};

const TROPHIES: Record<string, [number, TrophyType, string, string, string?][]> = {
  DEMO_GOW: [
    [0, "platinum", "Pai e Filho", "Obtenha todos os troféus"],
    [12, "gold", "Rainha das Valquírias", "Derrote Gná"],
    [5, "bronze", "Primeiros passos", "Conclua o prólogo"],
    [20, "silver", "Ferreiro", "Melhore uma arma ao máximo"],
    [7, "bronze", "Colecionador", "Encontre 10 artefatos"],
    [40, "silver", "Conquistador de Valhalla", "Conclua Valhalla", "001"],
    [41, "bronze", "Primeira tentativa", "Morra pela primeira vez em Valhalla", "001"],
  ],
  DEMO_HFW: [
    [0, "platinum", "Lenda de Horizon", "Obtenha todos os troféus"],
    [22, "silver", "Domadora de Máquinas", "Sobrescreva 20 tipos de máquinas"],
    [3, "bronze", "A caçada começa", "Abata sua primeira máquina"],
    [90, "gold", "Costas em Chamas", "Conclua Burning Shores", "001"],
  ],
  DEMO_TLOU: [
    [0, "platinum", "Sobrevivente nato", "Obtenha todos os troféus"],
    [7, "gold", "Sobrevivente", "Conclua o jogo no modo Sobrevivente"],
    [2, "bronze", "Seattle", "Chegue a Seattle"],
  ],
  DEMO_BB: [[0, "platinum", "Bloodborne", "Obtenha todos os troféus"], [3, "gold", "Pesadelo", "Derrote a Presença Lunar"]],
  DEMO_UNCH: [[0, "platinum", "Platina", "Obtenha todos os troféus"], [1, "bronze", "Primeiro tesouro", "Encontre um tesouro"]],
  DEMO_GRAV: [[0, "platinum", "Gravity Queen", "Obtenha todos os troféus"], [4, "bronze", "Queda livre", "Caia por 10 segundos"]],
  DEMO_ASTRO: [[0, "platinum", "Astro Mestre", "Obtenha todos os troféus"], [9, "gold", "Resgate total", "Salve todos os bots"]],
};

// [perfil, jogo, progresso, conquistas, horas desde o último troféu, tempo de jogo (h), troféus ganhos: [id, horas atrás, raridade]]
const PLAYS: [string, string, number, Counts, number, number, [number, number, number][]][] = [
  ["me", "gow", 92, counts(1, 6, 12, 17), 2, 74, [[0, 2, 6.8], [12, 28, 21], [5, 300, 96.1], [20, 120, 40.2], [41, 3, 55.1]]],
  ["me", "tlou", 64, counts(0, 1, 7, 10), 30, 38, [[7, 30, 11.4], [2, 400, 88]]],
  ["me", "unch", 100, counts(1, 4, 12, 40), 4000, 0, [[0, 4000, 18.5], [1, 4100, 90.2]]],
  ["me", "spidey", 0, counts(0, 0, 0, 0), 600, 1, []],
  ["me", "grav", 100, counts(1, 2, 8, 37), 9000, 0, [[0, 9000, 9.1], [4, 9100, 70]]],
  ["aloy", "hfw", 100, counts(1, 5, 14, 48), 1, 131, [[0, 1, 3.2], [22, 26, 34.9], [3, 500, 97], [90, 6, 8.3]]],
  ["aloy", "gow", 41, counts(0, 1, 4, 9), 50, 22, [[5, 50, 96.1]]],
  ["aloy", "bb", 100, counts(1, 6, 15, 12), 3000, 96, [[0, 3000, 4.6], [3, 3010, 18]]],
  ["ellie", "tlou", 88, counts(0, 3, 10, 12), 5, 51, [[7, 5, 11.4], [2, 200, 88]]],
  ["ellie", "astro", 100, counts(1, 5, 10, 29), 70, 19, [[0, 70, 12.7], [9, 72, 30]]],
];

const keyOf = (accountId: string) =>
  Object.keys(PROFILES).find((k) => PROFILES[k].accountId === accountId || (accountId === "me" && k === "me")) ?? "me";

function titlesOf(profileKey: string): Title[] {
  return PLAYS.filter((p) => p[0] === profileKey).map(([, g, progress, earned, h]) => {
    const { groups: _groups, ...game } = GAMES[g];
    return { ...game, progress, earned, lastUpdated: hoursAgo(h) };
  });
}

function playedOf(profileKey: string): PlayedGame[] {
  return PLAYS.filter((p) => p[0] === profileKey && p[5] > 0).map(([, g, , , h, hours]) => ({
    titleId: `${GAMES[g].id}-PLAYED`,
    name: GAMES[g].name,
    imageUrl: null,
    playSeconds: hours * 3600,
    lastPlayed: hoursAgo(h),
  }));
}

function trophiesOf(profileKey: string, gameId: string): TrophyRow[] {
  const play = PLAYS.find((p) => p[0] === profileKey && GAMES[p[1]].id === gameId);
  const earned = new Map((play?.[6] ?? []).map(([id, h, rate]) => [id, { h, rate }]));
  return (TROPHIES[gameId] ?? []).map(([id, type, name, detail, groupId]) => {
    const e = earned.get(id);
    return {
      id,
      type,
      name,
      detail,
      iconUrl: null,
      hidden: false,
      groupId: groupId ?? "default",
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
    recentTitles: (accountId) => delay(titlesOf(keyOf(accountId))),
    playedGames: (accountId) => delay(playedOf(keyOf(accountId))),
    trophyGroups: (game) => delay(Object.values(GAMES).find((g) => g.id === game.id)?.groups ?? []),
    gameTrophies: (accountId, game) => delay(trophiesOf(keyOf(accountId), game.id)),
    friends: () => delay([PROFILES.aloy, PROFILES.ellie]),
    feed: () => {
      const now = Date.now();
      const items = Object.keys(PROFILES).flatMap((k) => {
        const p = PROFILES[k];
        const owner = { accountId: p.accountId, onlineId: p.onlineId, avatarUrl: p.avatarUrl, isMe: k === "me" };
        return titlesOf(k).flatMap((title) =>
          feedItemsFromTrophies({ owner, title }, trophiesOf(k, title.id), now, getSettings().feedDays),
        );
      });
      return delay(sortFeed(items));
    },
  };
}
