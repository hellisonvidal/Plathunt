import { locale, t } from "../i18n";
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
  if (h === 0) return t("{m} min", { m });
  if (h >= 100) return t("{h} h", { h });
  return m ? t("{h} h {m} min", { h, m }) : t("{h} h", { h });
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

/** Categoria da lista de "jogados" ("ps5_native_game", "ps4_game"…) → plataforma. */
export function platformFromCategory(category: string | undefined | null): string | null {
  if (!category) return null;
  if (/^ps5/i.test(category)) return "PS5";
  if (/^ps4/i.test(category)) return "PS4";
  return null;
}

const earnedTotal = (t: Title) => t.earned.bronze + t.earned.silver + t.earned.gold + t.earned.platinum;

/**
 * A PSN não liga a lista de troféus (npCommunicationId) à de tempo de jogo
 * (titleId), então casamos pelo nome. Cada registro de tempo vai para UMA só
 * versão do jogo (ex.: PS4 e PS5 têm listas de troféus separadas): a da mesma
 * plataforma e, em empate, a com mais troféus. Assim o tempo não é contado em
 * dobro. Jogos de PS3/Vita não têm tempo.
 */
export function matchPlaytime(titles: Title[], played: PlayedGame[]): Map<string, number> {
  return new Map([...matchPlayed(titles, played)].map(([id, info]) => [id, info.seconds]));
}

export interface PlayInfo {
  seconds: number;
  /** Plataforma em que o jogo foi jogado (a do registro com mais tempo), se a PSN informar. */
  platform: string | null;
  /** Primeira vez que jogou (a mais antiga entre os registros do jogo), se a PSN informar. */
  firstPlayed: string | null;
}

/** Como `matchPlaytime`, mas também diz em qual plataforma cada jogo foi jogado. */
export function matchPlayed(titles: Title[], played: PlayedGame[]): Map<string, PlayInfo> {
  const byName = new Map<string, Title[]>();
  for (const t of titles) {
    const key = normalizeName(t.name);
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), t]);
  }

  const candidatesFor = (key: string): Title[] => {
    const exact = byName.get(key);
    if (exact) return exact;
    if (key.length < 6) return [];
    for (const [k, ts] of byName) {
      if (k.length >= 6 && (k.startsWith(key) || key.startsWith(k))) return ts;
    }
    return [];
  };

  const out = new Map<string, PlayInfo & { best: number }>();
  const earliest = (a: string | null, b: string | null | undefined) =>
    !b || !Number.isFinite(Date.parse(b)) ? a : !a || Date.parse(b) < Date.parse(a) ? b : a;
  for (const p of played) {
    if (p.playSeconds <= 0) continue;
    const key = normalizeName(p.name);
    if (!key) continue;
    const candidates = candidatesFor(key);
    if (!candidates.length) continue;
    const score = (t: Title) =>
      (p.platform && parsePlatforms(t.platform).includes(p.platform) ? 1_000_000 : 0) + earnedTotal(t);
    const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));
    const prev = out.get(best.id) ?? { seconds: 0, platform: null, firstPlayed: null, best: 0 };
    const leads = p.playSeconds > prev.best;
    out.set(best.id, {
      seconds: prev.seconds + p.playSeconds,
      platform: leads ? (p.platform ?? prev.platform) : prev.platform,
      firstPlayed: earliest(prev.firstPlayed, p.firstPlayed),
      best: Math.max(prev.best, p.playSeconds),
    });
  }
  return new Map([...out].map(([id, { seconds, platform, firstPlayed }]) => [id, { seconds, platform, firstPlayed }]));
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

const rank = (p: string) => (PLATFORM_ORDER.indexOf(p) + 1 || 99);

/** Plataforma em que cada jogo foi jogado, por id (vem da lista de "jogados"). */
export type PlayedOn = Map<string, string | null>;

/**
 * Uma lista de troféus pode valer para várias plataformas (ex.: "PS4,PSVITA"),
 * mas isso não quer dizer que o jogador jogou em todas. Cada jogo conta em UMA
 * plataforma: a registrada no tempo de jogo, se houver; senão a principal da
 * lista (PS5 › PS4 › PS3 › PS Vita).
 */
export function primaryPlatform(t: Title, playedOn?: string | null): string {
  const platforms = parsePlatforms(t.platform);
  if (playedOn && platforms.includes(playedOn)) return playedOn;
  return [...platforms].sort((a, b) => rank(a) - rank(b))[0] ?? t.platform;
}

/** Plataformas em que há jogos (uma por jogo), na ordem PS5 → PC. */
export function platformsOf(titles: Title[], playedOn?: PlayedOn): string[] {
  const set = new Set(titles.map((t) => primaryPlatform(t, playedOn?.get(t.id))));
  return [...set].sort((a, b) => rank(a) - rank(b));
}

/** Só jogos em que o jogador conquistou pelo menos um troféu. */
export function withEarnedTrophies(titles: Title[]): Title[] {
  return titles.filter((t) => earnedTotal(t) > 0);
}

export function filterByPlatform(titles: Title[], platform: string | null, playedOn?: PlayedOn): Title[] {
  if (!platform) return titles;
  return titles.filter((t) => primaryPlatform(t, playedOn?.get(t.id)) === platform);
}

/** Jogos de cada plataforma (cada jogo em uma só), em ordem alfabética. */
export function titlesByPlatform(titles: Title[], playedOn?: PlayedOn): Map<string, Title[]> {
  const out = new Map<string, Title[]>();
  for (const t of titles) {
    const p = primaryPlatform(t, playedOn?.get(t.id));
    out.set(p, [...(out.get(p) ?? []), t]);
  }
  for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name, locale(), { sensitivity: "base" }));
  return new Map([...out].sort(([a], [b]) => rank(a) - rank(b)));
}

export interface GameStats {
  games: number;
  completed: number;
  /** Jogos 100% sem DLC e com platina (`completed` conta os 100% com DLC). */
  completedNoDlc: number;
  /** Jogos 100% sem troféu de platina ("100% PSN"). */
  completedPsn: number;
  /** Jogos platinados ainda sem 100% (DLC pendente). */
  platinumOnly: number;
  /** Jogos sem platina e com troféus faltando. */
  unfinished: number;
  /** Troféus ainda não conquistados (por tipo), somando todos os jogos. */
  missing: Counts;
  totalMissing: number;
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

/**
 * "100%" no app: só jogos com DLC completos. Num jogo sem DLC, o 100% é o
 * mesmo momento da platina, então ele conta como platina, não como 100%.
 */
export const isComplete = (t: Pick<Title, "hasGroups" | "progress">) => t.hasGroups && t.progress >= 100;

/** Jogo 100% sem DLC e com platina (o 100% veio junto com a platina). */
export const isCompleteNoDlc = (t: Pick<Title, "hasGroups" | "progress" | "defined">) =>
  !t.hasGroups && t.progress >= 100 && t.defined.platinum > 0;

/** "100% PSN": jogo 100% que não tem troféu de platina (jogos menores, muitos de PS3 e Vita). */
export const isCompletePsn = (t: Pick<Title, "hasGroups" | "progress" | "defined">) =>
  !t.hasGroups && t.progress >= 100 && t.defined.platinum === 0;

/** Platinado, mas ainda sem 100% (faltam troféus de DLC). */
export const isPlatinumOnly = (t: Pick<Title, "earned" | "progress">) => t.earned.platinum > 0 && t.progress < 100;

/** Jogo ainda não concluído: sem platina e com troféus faltando. */
export const isUnfinished = (t: Pick<Title, "earned" | "progress">) => t.earned.platinum === 0 && t.progress < 100;

export function computeStats(titles: Title[], playtime: Map<string, number>, playedOn?: PlayedOn): GameStats {
  const trophies = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  const missing = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
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
    for (const k of ["bronze", "silver", "gold", "platinum"] as const) missing[k] += Math.max(0, t.defined[k] - t.earned[k]);
    progressSum += t.progress;
    if (isComplete(t)) completed++;
    const secs = playtime.get(t.id);
    if (secs) {
      playSeconds += secs;
      gamesWithPlaytime++;
    }
    const p = primaryPlatform(t, playedOn?.get(t.id));
    platformCount.set(p, (platformCount.get(p) ?? 0) + 1);
  }

  return {
    games: titles.length,
    completed,
    completedNoDlc: titles.filter(isCompleteNoDlc).length,
    completedPsn: titles.filter(isCompletePsn).length,
    platinumOnly: titles.filter(isPlatinumOnly).length,
    unfinished: titles.filter(isUnfinished).length,
    missing,
    totalMissing: missing.bronze + missing.silver + missing.gold + missing.platinum,
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
      .sort((a, b) => b.seconds - a.seconds),
  };
}

/** Ano em que o jogo começou: primeira vez jogada (PSN) ou, sem essa data, o último troféu. */
export function startYear(title: Title, firstPlayed?: Map<string, string | null>): number | null {
  const when = Date.parse(firstPlayed?.get(title.id) ?? title.lastUpdated);
  return Number.isFinite(when) ? new Date(when).getFullYear() : null;
}

export interface YearRow {
  year: number;
  /** Jogos começados no ano. */
  games: number;
  /** Platinas desses jogos. */
  platinums: number;
}

/**
 * Jogos por ano, do ano do primeiro jogo até hoje (anos sem jogos aparecem
 * com zero). O ano é o da primeira vez que jogou, pela PSN (PS4/PS5); sem
 * essa data (PS3, Vita), usa o ano do último troféu.
 */
export function gamesByYear(titles: Title[], firstPlayed: Map<string, string | null>, now = new Date()): YearRow[] {
  const byYear = new Map<number, YearRow>();
  for (const t of titles) {
    const year = startYear(t, firstPlayed);
    if (year === null) continue;
    const row = byYear.get(year) ?? { year, games: 0, platinums: 0 };
    row.games++;
    row.platinums += t.earned.platinum > 0 ? 1 : 0;
    byYear.set(year, row);
  }
  if (!byYear.size) return [];
  const first = Math.min(...byYear.keys());
  const last = Math.max(now.getFullYear(), ...byYear.keys());
  const out: YearRow[] = [];
  for (let y = first; y <= last; y++) out.push(byYear.get(y) ?? { year: y, games: 0, platinums: 0 });
  return out;
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
    : [{ id: "default", name: t("Jogo base"), iconUrl: null, defined: { bronze: 0, silver: 0, gold: 0, platinum: 0 } }];
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

export interface TitleComparison {
  /** Jogos que os dois jogaram (casados pelo nome). */
  common: { mine: Title; theirs: Title }[];
  onlyMine: Title[];
  onlyTheirs: Title[];
}

/** Compara as listas de jogos de dois jogadores (pelo nome normalizado), em ordem alfabética. */
export function compareTitles(mine: Title[], theirs: Title[]): TitleComparison {
  const byName = (a: Title, b: Title) => a.name.localeCompare(b.name, locale(), { sensitivity: "base" });
  const theirsByName = new Map(theirs.map((t) => [normalizeName(t.name), t]));
  const used = new Set<Title>();
  const common: TitleComparison["common"] = [];
  const onlyMine: Title[] = [];
  for (const t of mine) {
    const match = theirsByName.get(normalizeName(t.name));
    if (match && !used.has(match)) {
      used.add(match);
      common.push({ mine: t, theirs: match });
    } else onlyMine.push(t);
  }
  return {
    common: common.sort((a, b) => byName(a.mine, b.mine)),
    onlyMine: onlyMine.sort(byName),
    onlyTheirs: theirs.filter((t) => !used.has(t)).sort(byName),
  };
}

/** Jogo em comum com o tempo de jogo de cada jogador (em segundos). */
export interface CommonPlaytime {
  mine: Title;
  theirs: Title;
  mineSeconds: number;
  theirsSeconds: number;
}

/**
 * Jogos em comum (pelo nome, como em `compareTitles`) em que os dois têm tempo
 * de jogo registrado, do maior tempo somado para o menor.
 */
export function commonPlaytime(
  mine: Title[],
  minePlaytime: Map<string, number>,
  theirs: Title[],
  theirsPlaytime: Map<string, number>,
): CommonPlaytime[] {
  return compareTitles(mine, theirs)
    .common.map(({ mine: a, theirs: b }) => ({
      mine: a,
      theirs: b,
      mineSeconds: minePlaytime.get(a.id) ?? 0,
      theirsSeconds: theirsPlaytime.get(b.id) ?? 0,
    }))
    .filter((c) => c.mineSeconds > 0 && c.theirsSeconds > 0)
    .sort((x, y) => y.mineSeconds + y.theirsSeconds - (x.mineSeconds + x.theirsSeconds));
}

/** Do primeiro troféu à platina (ou ao último troféu, no 100%). */
export interface CompletionSpan {
  start: string;
  end: string;
  ms: number;
}

/**
 * Quanto tempo levou a platina e o 100% de um jogo, a partir das datas dos
 * troféus: começa no primeiro troféu conquistado e termina na platina (ou no
 * último troféu, quando o jogo está 100%).
 */
export function completionSpans(trophies: TrophyRow[]): { platinum: CompletionSpan | null; full: CompletionSpan | null } {
  const earned = trophies
    .filter((t) => t.earned && t.earnedAt)
    .map((t) => ({ type: t.type, at: Date.parse(t.earnedAt!) }))
    .filter((t) => Number.isFinite(t.at))
    .sort((a, b) => a.at - b.at);
  if (!earned.length) return { platinum: null, full: null };
  const span = (start: number, end: number): CompletionSpan => ({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    ms: Math.max(0, end - start),
  });
  const first = earned[0].at;
  const plat = earned.find((t) => t.type === "platinum");
  const all = trophies.length > 0 && trophies.every((t) => t.earned);
  return {
    platinum: plat ? span(first, plat.at) : null,
    full: all ? span(first, earned[earned.length - 1].at) : null,
  };
}

/** Duração longa e legível: "5 h", "12 dias", "3 meses e 4 dias", "1 ano e 2 meses". */
export function formatSpan(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return t("menos de 1 h");
  if (hours < 48) return t("{h} h", { h: Math.round(hours) });
  const days = Math.round(hours / 24);
  if (days < 60) return t("{n} dias", { n: days });
  const dayText = (n: number) => (n === 1 ? t("{n} dia", { n }) : t("{n} dias", { n }));
  const monthText = (n: number) => (n === 1 ? t("{n} mês", { n }) : t("{n} meses", { n }));
  const yearText = (n: number) => (n === 1 ? t("{n} ano", { n }) : t("{n} anos", { n }));
  if (days < 365) {
    const months = Math.floor(days / 30);
    const rest = days - months * 30;
    return rest ? t("{a} e {b}", { a: monthText(months), b: dayText(rest) }) : monthText(months);
  }
  const years = Math.floor(days / 365);
  const months = Math.floor((days - years * 365) / 30);
  return months ? t("{a} e {b}", { a: yearText(years), b: monthText(months) }) : yearText(years);
}
