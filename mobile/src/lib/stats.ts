import type { Counts, PlayedGame, Title, TrophyGroup, TrophyRow } from "../psn/types";

/** "PT228H56M33S" → segundos. */
export function parseDuration(iso: string | undefined | null): number {
  if (!iso) return 0;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return Math.round(Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0));
}

/** 412380 → "114 h 33 min"; menos de 1 h → "45 min". */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (h >= 100) return `${h.toLocaleString("pt-BR")} h`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Normaliza nomes de jogos para casar a lista de troféus com a de "jogados". */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[™®©]/g, "")
    .replace(/\b(ps4|ps5|playstation ?[45]|edition|remastered|trophies)\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * A PSN não liga a lista de troféus (npCommunicationId) à de tempo de jogo
 * (titleId), então casamos pelo nome. Jogos de PS3/Vita não têm tempo.
 */
export function matchPlaytime(titles: Title[], played: PlayedGame[]): Map<string, number> {
  const byName = new Map<string, number>();
  for (const p of played) {
    const key = normalizeName(p.name);
    if (key) byName.set(key, (byName.get(key) ?? 0) + p.playSeconds);
  }
  const out = new Map<string, number>();
  for (const t of titles) {
    const key = normalizeName(t.name);
    if (!key) continue;
    let secs = byName.get(key);
    if (secs === undefined && key.length >= 6) {
      for (const [k, v] of byName) {
        if (k.length >= 6 && (k.startsWith(key) || key.startsWith(k))) {
          secs = v;
          break;
        }
      }
    }
    if (secs) out.set(t.id, secs);
  }
  return out;
}

const PLATFORM_LABELS: Record<string, string> = {
  PS5: "PS5",
  PS4: "PS4",
  PS3: "PS3",
  PSVITA: "PS Vita",
  VITA: "PS Vita",
  PSPC: "PC",
  PC: "PC",
};
export const PLATFORM_ORDER = ["PS5", "PS4", "PS3", "PS Vita", "PC"];

/** "PS4,PSVITA" → ["PS4", "PS Vita"]. */
export function parsePlatforms(raw: string): string[] {
  const out = raw
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean)
    .map((p) => PLATFORM_LABELS[p] ?? p);
  return [...new Set(out)];
}

/** Plataformas que aparecem na lista de troféus, na ordem PS5 → PC. */
export function platformsOf(titles: Title[]): string[] {
  const set = new Set(titles.flatMap((t) => parsePlatforms(t.platform)));
  return [...set].sort((a, b) => rank(a) - rank(b));
}
const rank = (p: string) => (PLATFORM_ORDER.indexOf(p) + 1 || 99);

export function filterByPlatform(titles: Title[], platform: string | null): Title[] {
  if (!platform) return titles;
  return titles.filter((t) => parsePlatforms(t.platform).includes(platform));
}

export interface GameStats {
  games: number;
  completed: number;
  platinums: number;
  avgProgress: number;
  trophies: Counts;
  totalTrophies: number;
  playSeconds: number;
  /** Quantos jogos têm tempo de jogo conhecido. */
  gamesWithPlaytime: number;
  byPlatform: { platform: string; games: number }[];
  topPlayed: { title: Title; seconds: number }[];
}

export function computeStats(titles: Title[], playtime: Map<string, number>): GameStats {
  const trophies = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  let progressSum = 0;
  let completed = 0;
  let playSeconds = 0;
  let gamesWithPlaytime = 0;
  const platformCount = new Map<string, number>();

  for (const t of titles) {
    trophies.bronze += t.earned.bronze;
    trophies.silver += t.earned.silver;
    trophies.gold += t.earned.gold;
    trophies.platinum += t.earned.platinum;
    progressSum += t.progress;
    if (t.progress >= 100) completed++;
    const secs = playtime.get(t.id);
    if (secs) {
      playSeconds += secs;
      gamesWithPlaytime++;
    }
    for (const p of parsePlatforms(t.platform)) platformCount.set(p, (platformCount.get(p) ?? 0) + 1);
  }

  return {
    games: titles.length,
    completed,
    platinums: trophies.platinum,
    avgProgress: titles.length ? Math.round(progressSum / titles.length) : 0,
    trophies,
    totalTrophies: trophies.bronze + trophies.silver + trophies.gold + trophies.platinum,
    playSeconds,
    gamesWithPlaytime,
    byPlatform: [...platformCount]
      .map(([platform, games]) => ({ platform, games }))
      .sort((a, b) => rank(a.platform) - rank(b.platform)),
    topPlayed: titles
      .filter((t) => playtime.get(t.id))
      .map((t) => ({ title: t, seconds: playtime.get(t.id)! }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5),
  };
}

export interface GroupSection {
  group: TrophyGroup;
  isBase: boolean;
  trophies: TrophyRow[];
  earned: number;
}

/** Separa os troféus em jogo base + DLCs, na ordem dos grupos da PSN. */
export function groupTrophies(trophies: TrophyRow[], groups: TrophyGroup[]): GroupSection[] {
  const known = groups.length
    ? groups
    : [{ id: "default", name: "Jogo base", iconUrl: null, defined: { bronze: 0, silver: 0, gold: 0, platinum: 0 } }];
  const sections = known.map((group) => {
    const rows = trophies.filter((t) => t.groupId === group.id);
    return { group, isBase: group.id === "default", trophies: rows, earned: rows.filter((t) => t.earned).length };
  });
  // Troféus de um grupo que a PSN não listou vão para o jogo base.
  const listed = new Set(known.map((g) => g.id));
  const orphans = trophies.filter((t) => !listed.has(t.groupId));
  if (orphans.length) {
    const base = sections.find((s) => s.isBase) ?? sections[0];
    base.trophies.push(...orphans);
    base.earned += orphans.filter((t) => t.earned).length;
  }
  return sections.filter((s) => s.trophies.length > 0);
}
