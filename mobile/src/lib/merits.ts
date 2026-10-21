import { locale, t } from "../i18n";
import type { Counts, Profile, Title } from "../psn/types";
import type { ChallengeStats } from "./challenges";
import { genresOf, GENRES } from "./genres";
import { isComplete, primaryPlatform, withEarnedTrophies, type PlayedOn } from "./stats";

/**
 * Méritos: conquistas do próprio app, liberadas quando o jogador atinge
 * objetivos definidos aqui (platinas, troféus, nível, tempo de jogo...).
 * Tudo é calculado no celular a partir dos dados da PSN e dos desafios
 * salvos no app. São 5.000 méritos, incluindo os de gêneros de jogos.
 */

export interface MeritContext {
  profile: Profile;
  titles: Title[];
  /** Segundos de jogo por id de jogo. */
  playtime: Map<string, number>;
  playedOn: PlayedOn;
  /** null quando não se aplica (méritos de um amigo). */
  friends: number | null;
  reactions: number | null;
  /** Seus desafios (Atividades → Desafios); null para amigos. */
  challenges?: ChallengeStats | null;
  now: number;
}

export interface MeritCategory {
  id: string;
  label: string;
  icon: string;
}

/** Valor de "{x}" no texto; uma função é calculada na hora de mostrar (ex.: nome do gênero traduzido). */
export type MeritVar = string | number | (() => string);

export interface Merit {
  id: string;
  category: string;
  icon: string;
  /** Nome em português (chave de tradução); `nameVars` preenche "{p}" / "{y}". */
  name: string;
  nameVars?: Record<string, MeritVar>;
  /** Numeral romano dos méritos de série sem nome próprio (ex.: "VII" em "Lenda Platinada VII"). */
  suffix?: string;
  /** Descrição em português (chave de tradução); `vars` preenche "{n}" (a meta), "{p}"... */
  description: string;
  vars?: Record<string, MeritVar>;
  target: number;
  /** Valor atual do objetivo; null quando não dá para calcular. */
  value: (s: MeritStats) => number | null;
  /**
   * Quando o mérito foi liberado: a data do último troféu do jogo que fez o
   * jogador atingir a meta (ms). Sem isso (nível, tempo, amigos...), vale a
   * primeira vez que o app viu o mérito liberado.
   */
  when?: (s: MeritStats) => number | null;
}

export interface MeritResult {
  merit: Merit;
  value: number | null;
  done: boolean;
  /** 0–1. */
  ratio: number;
  /** Data (ms) do troféu que liberou o mérito, quando dá para saber. */
  at: number | null;
}

const resolveVars = (vars?: Record<string, MeritVar>) =>
  vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "function" ? v() : v]));

/** Nome do mérito no idioma atual (ex.: "Lenda Platinada VII"). */
export function meritName(m: Merit): string {
  const name = t(m.name, resolveVars(m.nameVars));
  return m.suffix ? `${name} ${m.suffix}` : name;
}

/** Descrição do mérito no idioma atual, com a meta formatada (1.000 / 1,000). */
export function meritDescription(m: Merit): string {
  return t(m.description, resolveVars(m.vars));
}

export const MERIT_CATEGORIES: MeritCategory[] = [
  { id: "platinas", label: "Platinas", icon: "🏆" },
  { id: "trofeus", label: "Troféus", icon: "🎖️" },
  { id: "ouro", label: "Ouro", icon: "🥇" },
  { id: "prata", label: "Prata", icon: "🥈" },
  { id: "bronze", label: "Bronze", icon: "🥉" },
  { id: "nivel", label: "Nível PSN", icon: "⭐" },
  { id: "colecao", label: "Coleção", icon: "📚" },
  { id: "conclusao", label: "Conclusão", icon: "💯" },
  { id: "ps5", label: "PS5", icon: "⬜" },
  { id: "ps4", label: "PS4", icon: "⬛" },
  { id: "ps3", label: "PS3", icon: "📀" },
  { id: "vita", label: "PS Vita", icon: "📱" },
  { id: "plataformas", label: "Plataformas", icon: "🎮" },
  { id: "tempo", label: "Tempo de jogo", icon: "⏱️" },
  { id: "assiduidade", label: "Assiduidade", icon: "📅" },
  { id: "temporadas", label: "Temporadas", icon: "🗓️" },
  { id: "dlc", label: "DLCs", icon: "🧩" },
  { id: "social", label: "Social", icon: "🤝" },
  { id: "curiosidades", label: "Curiosidades", icon: "🎲" },
  { id: "especiais", label: "Especiais", icon: "✨" },
  { id: "desafios", label: "Desafios", icon: "🏁" },
  { id: "generos", label: "Gêneros", icon: "🎭" },
  { id: "calendario", label: "Calendário", icon: "📆" },
  { id: "marcos", label: "Marcos", icon: "🪜" },
  { id: "alfabeto", label: "Alfabeto", icon: "🔤" },
];

interface PlatformStats {
  games: number;
  platinums: number;
  completed: number;
  trophies: number;
  hours: number;
  gold: number;
  silver: number;
  bronze: number;
  progressSum: number;
  half: number;
}

/** Números já calculados uma vez, usados por todos os méritos. */
export interface MeritStats {
  earned: Counts;
  total: number;
  level: number | null;
  levelProgress: number | null;
  games: number;
  completed: number;
  avgProgress: number;
  /** Jogos com conclusão de pelo menos `pct`%. */
  gamesAtLeast: (pct: number) => number;
  nearlyDone: number;
  /** Jogos que mal começaram (até 10%). */
  barelyStarted: number;
  platforms: Map<string, PlatformStats>;
  platinumPlatforms: Set<string>;
  playHours: number;
  maxGameHours: number;
  /** Jogos com pelo menos `h` horas. */
  gamesWithHours: (h: number) => number;
  avgHoursPerGame: number;
  /** Jogos com troféus atualizados nos últimos `days` dias. */
  activeWithin: (days: number) => number;
  /** Jogos com a última conquista em cada ano. */
  gamesByYear: Map<number, number>;
  platinumYears: Set<number>;
  completedYears: Set<number>;
  oldestYears: number;
  maxGoldInGame: number;
  maxTrophiesInGame: number;
  /** Jogos com pelo menos `n` troféus conquistados. */
  gamesWithTrophies: (n: number) => number;
  avgTrophiesPerGame: number;
  dlcGames: number;
  /** % de jogos platinados (só conta a partir de 4 jogos). */
  platinumRate: number;
  friends: number | null;
  reactions: number | null;
  challenges: ChallengeStats | null;
  isPlus: boolean;
  hasAboutMe: boolean;
  /** Jogos com troféus, do mais antigo ao mais recente (pela última conquista). */
  sorted: Title[];
  /** Data (ms) da última conquista de um jogo. */
  timeOf: (t: Title) => number;
  /** Data do n-ésimo jogo (em ordem de data) que atende a condição. */
  nthAt: (pred: (t: Title) => boolean, n: number) => number | null;
  /** Data em que a soma de `fn` pelos jogos (em ordem de data) chegou a n. */
  sumAt: (fn: (t: Title) => number, n: number) => number | null;
  platformOf: (t: Title) => string;
  genres: Map<string, GenreStats>;
  genresOf: (t: Title) => string[];
  /** Por ano da última conquista. */
  years: Map<number, { games: number; platinums: number; trophies: number }>;
  /** Por mês (0–11) da última conquista. */
  months: { games: number; platinums: number }[];
  /** Por dia da semana (0 = domingo). */
  weekdays: { games: number; platinums: number }[];
  /** Por período do dia: madrugada, manhã, tarde, noite. */
  periods: { games: number; platinums: number }[];
  /** Iniciais (A–Z) dos jogos e dos jogos platinados. */
  letters: Set<string>;
  platinumLetters: Set<string>;
  /** Jogos com número no nome (continuações). */
  sequels: number;
  /** Jogos com pelo menos `n` troféus de ouro. */
  gamesWithGold: (n: number) => number;
}

export interface GenreStats {
  games: number;
  platinums: number;
  completed: number;
  trophies: number;
  gold: number;
  hours: number;
  progressSum: number;
}

const DAY = 86_400_000;
const sum = (c: Counts) => c.platinum + c.gold + c.silver + c.bronze;
const PLATFORMS = ["PS5", "PS4", "PS3", "PS Vita"] as const;

export function meritStats(ctx: MeritContext): MeritStats {
  const played = withEarnedTrophies(ctx.titles);
  const platformOf = (t: Title) => primaryPlatform(t, ctx.playedOn.get(t.id));
  const fromTitles = played.reduce(
    (acc, t) => ({
      platinum: acc.platinum + t.earned.platinum,
      gold: acc.gold + t.earned.gold,
      silver: acc.silver + t.earned.silver,
      bronze: acc.bronze + t.earned.bronze,
    }),
    { platinum: 0, gold: 0, silver: 0, bronze: 0 },
  );
  // O resumo do perfil conta tudo; a lista de jogos é a reserva.
  const earned = ctx.profile.earned ?? fromTitles;
  const hoursOf = (t: Title) => (ctx.playtime.get(t.id) ?? 0) / 3600;
  const seconds = [...ctx.playtime.values()];
  const yearOf = (t: Title) => new Date(t.lastUpdated).getFullYear();
  const updated = played.map((t) => new Date(t.lastUpdated).getTime()).filter(Number.isFinite);

  const platforms = new Map<string, PlatformStats>();
  for (const t of played) {
    const p = platformOf(t);
    const s = platforms.get(p) ?? {
      games: 0,
      platinums: 0,
      completed: 0,
      trophies: 0,
      hours: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      progressSum: 0,
      half: 0,
    };
    s.games += 1;
    s.platinums += t.earned.platinum;
    s.completed += isComplete(t) ? 1 : 0;
    s.trophies += sum(t.earned);
    s.hours += hoursOf(t);
    s.gold += t.earned.gold;
    s.silver += t.earned.silver;
    s.bronze += t.earned.bronze;
    s.progressSum += t.progress;
    s.half += t.progress >= 50 ? 1 : 0;
    platforms.set(p, s);
  }

  // Datas: a última conquista de cada jogo (a PSN não dá a data de cada troféu na lista de jogos).
  const timeOf = (t: Title) => Date.parse(t.lastUpdated);
  const sorted = played.filter((t) => Number.isFinite(timeOf(t))).sort((a, b) => timeOf(a) - timeOf(b));
  const nthAt = (pred: (t: Title) => boolean, n: number) => {
    let count = 0;
    for (const t of sorted) if (pred(t) && ++count >= n) return timeOf(t);
    return null;
  };
  const sumAt = (fn: (t: Title) => number, n: number) => {
    let total = 0;
    for (const t of sorted) if ((total += fn(t)) >= n) return timeOf(t);
    return null;
  };

  const genreCache = new Map<string, string[]>();
  const genresOfTitle = (t: Title) => {
    let g = genreCache.get(t.id);
    if (!g) genreCache.set(t.id, (g = genresOf(t.name)));
    return g;
  };
  const genres = new Map<string, GenreStats>();
  for (const t of played) {
    for (const g of genresOfTitle(t)) {
      const s = genres.get(g) ?? { games: 0, platinums: 0, completed: 0, trophies: 0, gold: 0, hours: 0, progressSum: 0 };
      s.games += 1;
      s.platinums += t.earned.platinum > 0 ? 1 : 0;
      s.completed += isComplete(t) ? 1 : 0;
      s.trophies += sum(t.earned);
      s.gold += t.earned.gold;
      s.hours += hoursOf(t);
      s.progressSum += t.progress;
      genres.set(g, s);
    }
  }

  const years = new Map<number, { games: number; platinums: number; trophies: number }>();
  const months = Array.from({ length: 12 }, () => ({ games: 0, platinums: 0 }));
  const weekdays = Array.from({ length: 7 }, () => ({ games: 0, platinums: 0 }));
  const periods = Array.from({ length: 4 }, () => ({ games: 0, platinums: 0 }));
  const letters = new Set<string>();
  const platinumLetters = new Set<string>();
  for (const t of sorted) {
    const d = new Date(timeOf(t));
    const plat = t.earned.platinum > 0 ? 1 : 0;
    const y = years.get(d.getFullYear()) ?? { games: 0, platinums: 0, trophies: 0 };
    y.games += 1;
    y.platinums += plat;
    y.trophies += sum(t.earned);
    years.set(d.getFullYear(), y);
    months[d.getMonth()].games += 1;
    months[d.getMonth()].platinums += plat;
    weekdays[d.getDay()].games += 1;
    weekdays[d.getDay()].platinums += plat;
    const period = Math.floor(d.getHours() / 6);
    periods[period].games += 1;
    periods[period].platinums += plat;
  }
  for (const t of played) {
    const letter = initialOf(t.name);
    if (!letter) continue;
    letters.add(letter);
    if (t.earned.platinum > 0) platinumLetters.add(letter);
  }
  const gamesByYear = new Map<number, number>();
  for (const t of played) gamesByYear.set(yearOf(t), (gamesByYear.get(yearOf(t)) ?? 0) + 1);
  const playHours = Math.floor(seconds.reduce((a, b) => a + b, 0) / 3600);
  const withPlaytime = played.filter((t) => hoursOf(t) > 0).length;

  return {
    earned,
    total: sum(earned),
    level: ctx.profile.level,
    levelProgress: ctx.profile.levelProgress,
    games: played.length,
    completed: played.filter(isComplete).length,
    avgProgress: played.length ? Math.round(played.reduce((a, t) => a + t.progress, 0) / played.length) : 0,
    gamesAtLeast: (pct) => played.filter((t) => t.progress >= pct).length,
    nearlyDone: played.filter((t) => t.progress >= 90 && t.progress < 100).length,
    barelyStarted: played.filter((t) => t.progress <= 10).length,
    platforms,
    platinumPlatforms: new Set(played.filter((t) => t.earned.platinum > 0).map(platformOf)),
    playHours,
    maxGameHours: Math.floor(Math.max(0, ...seconds) / 3600),
    gamesWithHours: (h) => played.filter((t) => hoursOf(t) >= h).length,
    avgHoursPerGame: withPlaytime ? Math.floor(playHours / withPlaytime) : 0,
    activeWithin: (days) => updated.filter((at) => ctx.now - at <= days * DAY).length,
    gamesByYear,
    platinumYears: new Set(played.filter((t) => t.earned.platinum > 0).map(yearOf)),
    completedYears: new Set(played.filter(isComplete).map(yearOf)),
    oldestYears: updated.length ? Math.floor((ctx.now - Math.min(...updated)) / (365.25 * DAY)) : 0,
    maxGoldInGame: Math.max(0, ...played.map((t) => t.earned.gold)),
    maxTrophiesInGame: Math.max(0, ...played.map((t) => sum(t.earned))),
    gamesWithTrophies: (n) => played.filter((t) => sum(t.earned) >= n).length,
    avgTrophiesPerGame: played.length ? Math.floor(sum(fromTitles) / played.length) : 0,
    dlcGames: played.filter((t) => t.hasGroups).length,
    platinumRate: played.length >= 4 ? Math.round((played.filter((t) => t.earned.platinum > 0).length / played.length) * 100) : 0,
    friends: ctx.friends,
    reactions: ctx.reactions,
    challenges: ctx.challenges ?? null,
    isPlus: ctx.profile.isPlus,
    hasAboutMe: !!ctx.profile.aboutMe?.trim(),
    sorted,
    timeOf,
    nthAt,
    sumAt,
    platformOf,
    genres,
    genresOf: genresOfTitle,
    years,
    months,
    weekdays,
    periods,
    letters,
    platinumLetters,
    sequels: played.filter((t) => SEQUEL.test(t.name)).length,
    gamesWithGold: (n) => played.filter((t) => t.earned.gold >= n).length,
  };
}

/** Inicial do jogo (A–Z), sem acento e ignorando "The". */
function initialOf(name: string): string | null {
  const n = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^the\s+/i, "")
    .toUpperCase();
  const m = n.match(/[A-Z]/);
  return m ? m[0] : null;
}

/** Nome com número de continuação: "2", "III", "4: ...". */
const SEQUEL = /(\s|^)(\d{1,2}|II|III|IV|V|VI|VII|VIII|IX|X)(\b|:)/;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX"];
/**
 * Série de méritos com metas crescentes. Os primeiros recebem os nomes da
 * lista; os demais, o nome-base com numeral romano (ex.: "Lenda VII").
 * A descrição é um texto com "{n}" (a meta), traduzido na hora de mostrar.
 */
function series(opts: {
  key: string;
  category: string;
  icon: string;
  targets: number[];
  names?: string[];
  base: string;
  baseVars?: Record<string, MeritVar>;
  describe: (n: number) => string;
  vars?: Record<string, MeritVar>;
  value: Merit["value"];
  /** Data em que a meta n foi atingida (ver Merit.when). */
  when?: (s: MeritStats, n: number) => number | null;
}): Merit[] {
  return opts.targets.map((target, i) => {
    const own = opts.names?.[i];
    return {
      id: `${opts.key}-${target}`,
      category: opts.category,
      icon: opts.icon,
      name: own ?? opts.base,
      ...(own ? {} : { nameVars: opts.baseVars, suffix: ROMAN[i] ?? String(i + 1) }),
      description: opts.describe(target),
      vars: { n: target, ...opts.vars },
      target,
      value: opts.value,
      ...(opts.when ? { when: (s: MeritStats) => opts.when!(s, target) } : {}),
    };
  });
}

const one = (
  id: string,
  category: string,
  icon: string,
  name: string,
  description: string,
  value: Merit["value"],
  target = 1,
  extra: Pick<Merit, "nameVars" | "vars" | "when"> = {},
): Merit => ({ id, category, icon, name, description, target, value, ...extra });

const has = (b: boolean) => (b ? 1 : 0);
const yearOf = (t: Title) => new Date(t.lastUpdated).getFullYear();
/** Texto no singular (meta 1) ou no plural. */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const platform = (s: MeritStats, p: string) => s.platforms.get(p);

/** Anos com troféus: do PS3 (2008) até hoje. */
const SEASONS = Array.from({ length: 19 }, (_, i) => 2008 + i);
/** O ano vai como texto para não sair formatado como número (2.026). */
const season = (y: number) => ({ nameVars: { y: String(y) }, vars: { y: String(y) } });

function platformMerits(p: (typeof PLATFORMS)[number], category: string, icon: string): Merit[] {
  const tag = p === "PS Vita" ? "Vita" : p;
  return [
    ...series({
      key: `${category}-jogos`,
      category,
      icon,
      targets: [1, 10, 25, 50, 100, 200],
      base: "Biblioteca {p}",
      baseVars: { p: tag },
      describe: (n) => plural(n, "Tenha troféus em {n} jogo de {p}", "Tenha troféus em {n} jogos de {p}"),
      vars: { p },
      when: (s, n) => s.nthAt((t) => s.platformOf(t) === p, n),
      value: (s) => platform(s, p)?.games ?? 0,
    }),
    ...series({
      key: `${category}-platinas`,
      category,
      icon: "💎",
      targets: [1, 5, 10, 25, 50, 100],
      base: "Platina {p}",
      baseVars: { p: tag },
      describe: (n) => plural(n, "Conquiste {n} platina no {p}", "Conquiste {n} platinas no {p}"),
      vars: { p },
      when: (s, n) => s.nthAt((t) => s.platformOf(t) === p && t.earned.platinum > 0, n),
      value: (s) => platform(s, p)?.platinums ?? 0,
    }),
    ...series({
      key: `${category}-completos`,
      category,
      icon: "💯",
      targets: [1, 5, 10, 25, 50],
      base: "Perfeição {p}",
      baseVars: { p: tag },
      describe: (n) => plural(n, "Complete {n} jogo de {p} em 100%", "Complete {n} jogos de {p} em 100%"),
      vars: { p },
      when: (s, n) => s.nthAt((t) => s.platformOf(t) === p && isComplete(t), n),
      value: (s) => platform(s, p)?.completed ?? 0,
    }),
    ...series({
      key: `${category}-trofeus`,
      category,
      icon: "🎖️",
      targets: [100, 500, 1000, 2500, 5000],
      base: "Troféus {p}",
      baseVars: { p: tag },
      describe: () => "Conquiste {n} troféus no {p}",
      vars: { p },
      when: (s, n) => s.sumAt((t) => (s.platformOf(t) === p ? sum(t.earned) : 0), n),
      value: (s) => platform(s, p)?.trophies ?? 0,
    }),
    ...(p === "PS5" || p === "PS4"
      ? series({
          key: `${category}-horas`,
          category,
          icon: "⏱️",
          targets: [10, 100, 500, 1000, 2500],
          base: "Horas de {p}",
          baseVars: { p: tag },
          describe: () => "Jogue {n} horas no {p}",
          vars: { p },
          value: (s) => Math.floor(platform(s, p)?.hours ?? 0),
        })
      : []),
  ];
}

const BASE_MERITS: Merit[] = [
  // Platinas
  ...series({
    key: "platinas",
    category: "platinas",
    icon: "🏆",
    targets: [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100, 125, 150, 175, 200, 250, 300, 400, 500],
    names: ["Primeira Platina", "Dose Dupla", "Trinca", "Quarteto", "Mão de Platina", "Caçador de Platinas", "Colecionador Platinado", "Vinte Brilhos", "Bodas de Prata", "Trinta e Contando", "Quarentão", "Meio Centenário", "Sessentão", "Brilho Eterno", "Noventa Graus", "Centurião Platinado"],
    base: "Lenda Platinada",
    describe: (n) => plural(n, "Conquiste {n} platina", "Conquiste {n} platinas"),
    when: (s, n) => s.nthAt((t) => t.earned.platinum > 0, n),
    value: (s) => s.earned.platinum,
  }),
  // Troféus no total
  ...series({
    key: "trofeus",
    category: "trofeus",
    icon: "🎖️",
    targets: [1, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 9000, 10000, 12500, 15000, 20000, 25000],
    names: ["Primeiro Troféu", "Primeiros Passos", "Aquecendo", "Cinquentinha", "Centena", "Embalado", "Duzentos", "Dedicado", "Trezentos de Esparta", "Quatrocentos", "Meio Milhar", "Setecentos e Cinquenta", "Milhar"],
    base: "Colecionador de Troféus",
    describe: (n) => plural(n, "Conquiste {n} troféu no total", "Conquiste {n} troféus no total"),
    when: (s, n) => s.sumAt((t) => sum(t.earned), n),
    value: (s) => s.total,
  }),
  ...series({
    key: "ouro",
    category: "ouro",
    icon: "🥇",
    targets: [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000],
    names: ["Toque de Ouro", "Pepita", "Garimpeiro", "Veio de Ouro", "Mina de Ouro", "Barra de Ouro", "Cem Ouros", "Cofre Cheio", "Febre do Ouro", "Rei Midas"],
    base: "Tesouro Dourado",
    describe: (n) => plural(n, "Conquiste {n} troféu de ouro", "Conquiste {n} troféus de ouro"),
    when: (s, n) => s.sumAt((t) => t.earned.gold, n),
    value: (s) => s.earned.gold,
  }),
  ...series({
    key: "prata",
    category: "prata",
    icon: "🥈",
    targets: [1, 10, 25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3500, 5000],
    names: ["Primeira Prata", "Reflexo Prateado", "Talheres de Prata", "Prataria", "Cem Pratas", "Lua de Prata", "Bandeja de Prata"],
    base: "Baú de Prata",
    describe: (n) => plural(n, "Conquiste {n} troféu de prata", "Conquiste {n} troféus de prata"),
    when: (s, n) => s.sumAt((t) => t.earned.silver, n),
    value: (s) => s.earned.silver,
  }),
  ...series({
    key: "bronze",
    category: "bronze",
    icon: "🥉",
    targets: [1, 10, 25, 50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000],
    names: ["Primeiro Bronze", "Idade do Bronze", "Liga Metálica", "Cinquenta Bronzes", "Cem Bronzes", "Forja de Bronze", "Quinhentos Bronzes"],
    base: "Estátua de Bronze",
    describe: (n) => plural(n, "Conquiste {n} troféu de bronze", "Conquiste {n} troféus de bronze"),
    when: (s, n) => s.sumAt((t) => t.earned.bronze, n),
    value: (s) => s.earned.bronze,
  }),
  ...series({
    key: "nivel",
    category: "nivel",
    icon: "⭐",
    targets: [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 999],
    names: ["Começo de Tudo", "Recruta", "Novato", "Cadete", "Aprendiz", "Iniciado", "Aventureiro", "Explorador", "Experiente", "Habilidoso", "Especialista", "Veterano", "Elite", "Três Dígitos"],
    base: "Mestre da PSN",
    describe: () => "Chegue ao nível {n} da PSN",
    value: (s) => s.level,
  }),
  one("nivel-meio", "nivel", "📈", "Meio Caminho do Nível", "Esteja com 50% ou mais do caminho para o próximo nível", (s) => s.levelProgress, 50),
  one("nivel-quase", "nivel", "📈", "Quase Subindo", "Esteja com 90% ou mais do caminho para o próximo nível", (s) => s.levelProgress, 90),
  // Coleção
  ...series({
    key: "colecao",
    category: "colecao",
    icon: "📚",
    targets: [1, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000],
    names: ["Primeiro Jogo", "Prateleira", "Estante", "Gaveta Cheia", "Coleção Séria", "Biblioteca", "Trinta Títulos", "Acervo", "Cinquenta Jogos", "Colecionador", "Cem Jogos"],
    base: "Arquivo Vivo",
    describe: (n) => plural(n, "Tenha troféus em {n} jogo", "Tenha troféus em {n} jogos"),
    when: (s, n) => s.nthAt(() => true, n),
    value: (s) => s.games,
  }),
  ...series({
    key: "colecao-50trofeus",
    category: "colecao",
    icon: "🎯",
    targets: [1, 10, 25, 50],
    base: "Jogo Explorado",
    describe: (n) =>
      plural(n, "Tenha {n} jogo com 50 troféus ou mais conquistados", "Tenha {n} jogos com 50 troféus ou mais conquistados"),
    when: (s, n) => s.nthAt((t) => sum(t.earned) >= 50, n),
    value: (s) => s.gamesWithTrophies(50),
  }),
  ...series({
    key: "colecao-100trofeus",
    category: "colecao",
    icon: "🎯",
    targets: [1, 5, 10],
    base: "Jogo Gigante",
    describe: (n) =>
      plural(n, "Tenha {n} jogo com 100 troféus ou mais conquistados", "Tenha {n} jogos com 100 troféus ou mais conquistados"),
    when: (s, n) => s.nthAt((t) => sum(t.earned) >= 100, n),
    value: (s) => s.gamesWithTrophies(100),
  }),
  ...series({
    key: "colecao-comecos",
    category: "colecao",
    icon: "🌱",
    targets: [5, 10, 25],
    base: "Muitos Começos",
    describe: () => "Tenha {n} jogos com até 10% de conclusão",
    value: (s) => s.barelyStarted,
  }),
  // Conclusão
  ...series({
    key: "conclusao",
    category: "conclusao",
    icon: "💯",
    targets: [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200],
    names: ["Completista", "Dois Perfeitos", "Três Perfeitos", "Cinco Perfeitos", "Dez Perfeitos", "Quinze Perfeitos", "Vinte Perfeitos", "Perfeccionista", "Trinta Perfeitos", "Quarenta Perfeitos", "Obsessivo", "Setenta e Cinco Perfeitos", "Cem por Cento"],
    base: "Perfeição Absoluta",
    describe: (n) => plural(n, "Complete {n} jogo em 100%", "Complete {n} jogos em 100%"),
    when: (s, n) => s.nthAt(isComplete, n),
    value: (s) => s.completed,
  }),
  ...series({
    key: "conclusao-media",
    category: "conclusao",
    icon: "📈",
    targets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    base: "Média Alta",
    describe: () => "Tenha conclusão média de {n}% ou mais",
    value: (s) => s.avgProgress,
  }),
  ...series({
    key: "conclusao-metade",
    category: "conclusao",
    icon: "🧭",
    targets: [1, 5, 10, 25, 50, 100, 200],
    base: "Não Abandona",
    describe: (n) => plural(n, "Passe de 50% em {n} jogo", "Passe de 50% em {n} jogos"),
    when: (s, n) => s.nthAt((t) => t.progress >= 50, n),
    value: (s) => s.gamesAtLeast(50),
  }),
  ...series({
    key: "conclusao-75",
    category: "conclusao",
    icon: "🚀",
    targets: [1, 5, 10, 25, 50, 100],
    base: "Reta Final",
    describe: (n) => plural(n, "Passe de 75% em {n} jogo", "Passe de 75% em {n} jogos"),
    when: (s, n) => s.nthAt((t) => t.progress >= 75, n),
    value: (s) => s.gamesAtLeast(75),
  }),
  ...series({
    key: "conclusao-25",
    category: "conclusao",
    icon: "🐢",
    targets: [1, 10, 25, 50, 100, 200],
    base: "Sem Pressa",
    describe: (n) => plural(n, "Passe de 25% em {n} jogo", "Passe de 25% em {n} jogos"),
    when: (s, n) => s.nthAt((t) => t.progress >= 25, n),
    value: (s) => s.gamesAtLeast(25),
  }),
  ...series({
    key: "conclusao-quase",
    category: "conclusao",
    icon: "🎯",
    targets: [1, 3, 5, 10],
    base: "Quase Lá",
    describe: (n) => plural(n, "Tenha {n} jogo entre 90% e 99%", "Tenha {n} jogos entre 90% e 99%"),
    value: (s) => s.nearlyDone,
  }),
  // Plataformas
  ...platformMerits("PS5", "ps5", "⬜"),
  ...platformMerits("PS4", "ps4", "⬛"),
  ...platformMerits("PS3", "ps3", "📀"),
  ...platformMerits("PS Vita", "vita", "📱"),
  ...series({
    key: "plataformas",
    category: "plataformas",
    icon: "🌐",
    targets: [1, 2, 3, 4],
    names: ["Uma Plataforma", "Multiplataforma", "Três Gerações", "Todas as Gerações"],
    base: "Plataformas",
    describe: (n) =>
      plural(
        n,
        "Conquiste troféus em {n} plataforma (PS3, PS4, PS5 ou PS Vita)",
        "Conquiste troféus em {n} plataformas (PS3, PS4, PS5 ou PS Vita)",
      ),
    when: (s, n) => {
      const seen = new Set<string>();
      for (const t of s.sorted) {
        const p = s.platformOf(t);
        if ((PLATFORMS as readonly string[]).includes(p)) seen.add(p);
        if (seen.size >= n) return s.timeOf(t);
      }
      return null;
    },
    value: (s) => PLATFORMS.filter((p) => (platform(s, p)?.games ?? 0) > 0).length,
  }),
  one("plataformas-platina-todas", "plataformas", "💎", "Platina em Todas", "Conquiste uma platina em PS3, PS4, PS5 e PS Vita", (s) =>
    PLATFORMS.filter((p) => s.platinumPlatforms.has(p)).length, 4),
  // Tempo de jogo
  ...series({
    key: "tempo",
    category: "tempo",
    icon: "⏱️",
    targets: [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000],
    names: ["Primeira Hora", "Tarde de Jogo", "Hora de Jogar", "Dia Inteiro", "Fim de Semana Longo", "Férias", "Cem Horas", "Maratonista", "Duzentas Horas", "Dedicação Total", "Trezentas Horas", "Quatrocentas Horas", "Quinhentas Horas", "Sem Dormir", "Mil Horas"],
    base: "Vida de Gamer",
    describe: (n) => plural(n, "Jogue {n} hora no total (PS4 e PS5)", "Jogue {n} horas no total (PS4 e PS5)"),
    value: (s) => s.playHours,
  }),
  ...series({
    key: "tempo-jogo",
    category: "tempo",
    icon: "🔥",
    targets: [10, 25, 50, 100, 200, 300, 500, 1000],
    names: ["Fisgado", "Envolvido", "Imerso", "Maratona", "Morador", "Cidadão Honorário", "Vida Dedicada", "Casamento"],
    base: "Um Só Jogo",
    describe: () => "Jogue {n} horas em um só jogo",
    value: (s) => s.maxGameHours,
  }),
  ...series({
    key: "tempo-10h",
    category: "tempo",
    icon: "🕹️",
    targets: [1, 5, 10, 25, 50, 100],
    base: "Jogos Longos",
    describe: (n) => plural(n, "Tenha {n} jogo com 10 horas ou mais", "Tenha {n} jogos com 10 horas ou mais"),
    value: (s) => s.gamesWithHours(10),
  }),
  ...series({
    key: "tempo-media",
    category: "tempo",
    icon: "⌛",
    targets: [10, 25, 50],
    base: "Média de Horas",
    describe: () => "Tenha média de {n} horas por jogo",
    value: (s) => s.avgHoursPerGame,
  }),
  // Assiduidade
  ...[
    [1, 1, "Hoje Tem", "Ganhe troféus em um jogo nas últimas 24 horas"],
    [3, 1, "Fim de Semana Gamer", "Ganhe troféus em um jogo nos últimos 3 dias"],
    [3, 3, "Três Dias, Três Jogos", "Ganhe troféus em 3 jogos nos últimos 3 dias"],
    [7, 1, "Em Atividade", "Ganhe troféus em um jogo nos últimos 7 dias"],
    [7, 3, "Semana Cheia", "Ganhe troféus em 3 jogos nos últimos 7 dias"],
    [7, 5, "Semana Intensa", "Ganhe troféus em 5 jogos nos últimos 7 dias"],
    [14, 3, "Quinzena Ativa", "Ganhe troféus em 3 jogos nos últimos 14 dias"],
    [14, 5, "Quinzena Agitada", "Ganhe troféus em 5 jogos nos últimos 14 dias"],
    [30, 1, "Presente no Mês", "Ganhe troféus em um jogo nos últimos 30 dias"],
    [30, 5, "Mês Agitado", "Ganhe troféus em 5 jogos nos últimos 30 dias"],
    [30, 10, "Mês Intenso", "Ganhe troféus em 10 jogos nos últimos 30 dias"],
    [60, 10, "Bimestre Cheio", "Ganhe troféus em 10 jogos nos últimos 60 dias"],
    [90, 5, "Trimestre Ativo", "Ganhe troféus em 5 jogos nos últimos 90 dias"],
    [90, 15, "Trimestre Intenso", "Ganhe troféus em 15 jogos nos últimos 90 dias"],
    [180, 10, "Semestre Produtivo", "Ganhe troféus em 10 jogos nos últimos 6 meses"],
    [180, 25, "Semestre Lendário", "Ganhe troféus em 25 jogos nos últimos 6 meses"],
    [365, 10, "Ano Produtivo", "Ganhe troféus em 10 jogos no último ano"],
    [365, 25, "Ano Lendário", "Ganhe troféus em 25 jogos no último ano"],
    [365, 50, "Ano Sem Parar", "Ganhe troféus em 50 jogos no último ano"],
    [365, 100, "Ano Insano", "Ganhe troféus em 100 jogos no último ano"],
  ].map(([days, n, name, description]) =>
    one(`ativo-${days}-${n}`, "assiduidade", "📅", name as string, description as string, (s) => s.activeWithin(days as number), n as number),
  ),
  ...series({
    key: "veterano",
    category: "assiduidade",
    icon: "🕰️",
    targets: [1, 2, 3, 5, 7, 10, 12, 15],
    names: ["Um Ano de Troféus", "Dois Anos", "Três Anos", "Velha Guarda", "Sete Anos", "Década de Troféus", "Doze Anos", "Quinze Anos"],
    base: "Veterano",
    describe: (n) => plural(n, "Tenha troféus de {n} ano atrás ou mais", "Tenha troféus de {n} anos atrás ou mais"),
    when: (s, n) => (s.sorted.length ? s.timeOf(s.sorted[0]) + n * 365.25 * DAY : null),
    value: (s) => s.oldestYears,
  }),
  // Temporadas (por ano; vale o ano da última conquista de cada jogo)
  ...SEASONS.map((y) =>
    one(`temporada-${y}`, "temporadas", "🗓️", "Temporada {y}", "Tenha um jogo com troféus conquistados em {y}", (s) =>
      s.gamesByYear.get(y) ?? 0, 1, { ...season(y), when: (s) => s.nthAt((t) => yearOf(t) === y, 1) }),
  ),
  ...SEASONS.map((y) =>
    one(`temporada-platina-${y}`, "temporadas", "🏆", "Platina de {y}", "Tenha um jogo platinado com a última conquista em {y}", (s) =>
      has(s.platinumYears.has(y)), 1, { ...season(y), when: (s) => s.nthAt((t) => yearOf(t) === y && t.earned.platinum > 0, 1) }),
  ),
  ...SEASONS.map((y) =>
    one(`temporada-completo-${y}`, "temporadas", "💯", "Perfeição de {y}", "Tenha um jogo 100% com a última conquista em {y}", (s) =>
      has(s.completedYears.has(y)), 1, { ...season(y), when: (s) => s.nthAt((t) => yearOf(t) === y && isComplete(t), 1) }),
  ),
  ...series({
    key: "temporada-max",
    category: "temporadas",
    icon: "📆",
    targets: [5, 10, 20],
    names: ["Ano de Cinco", "Ano de Dez", "Ano de Vinte"],
    base: "Ano Cheio",
    describe: () => "Tenha {n} jogos com a última conquista no mesmo ano",
    value: (s) => Math.max(0, ...s.gamesByYear.values()),
  }),
  // DLCs
  ...series({
    key: "dlc",
    category: "dlc",
    icon: "🧩",
    targets: [1, 5, 10, 25, 50],
    names: ["Expansão", "Conteúdo Extra", "Passe de Temporada", "Edição Completa", "Edição Definitiva"],
    base: "DLCs",
    describe: (n) => plural(n, "Tenha troféus em {n} jogo com DLC", "Tenha troféus em {n} jogos com DLC"),
    when: (s, n) => s.nthAt((t) => t.hasGroups, n),
    value: (s) => s.dlcGames,
  }),
  // Social
  ...series({
    key: "social",
    category: "social",
    icon: "🤝",
    targets: [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 1000],
    names: ["Primeiro Amigo", "Panelinha", "Turma", "Grupo de Jogo", "Clã", "Guilda", "Comunidade", "Arena", "Estádio", "Popular", "Celebridade", "Ídolo", "Lotado", "Mil Amigos"],
    base: "Rede de Amigos",
    describe: (n) => plural(n, "Tenha {n} amigo na PSN", "Tenha {n} amigos na PSN"),
    value: (s) => s.friends,
  }),
  ...series({
    key: "curtidas",
    category: "social",
    icon: "❤️",
    targets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    names: ["Primeira Curtida", "Simpático", "Incentivador", "Animador", "Torcida", "Fã Número Um", "Torcida Organizada", "Arquibancada", "Mil Curtidas"],
    base: "Curtidas",
    describe: (n) => plural(n, "Curta {n} conquista nas Atividades", "Curta {n} conquistas nas Atividades"),
    value: (s) => s.reactions,
  }),
  // Curiosidades
  one("curioso-42", "curiosidades", "🌌", "A Resposta", "Conquiste {n} troféus no total", (s) => s.total, 42, { vars: { n: 42 }, when: (s) => s.sumAt((t) => sum(t.earned), 42) }),
  one("curioso-777", "curiosidades", "🎰", "Sorte Grande", "Conquiste {n} troféus no total", (s) => s.total, 777, {
    vars: { n: 777 }, when: (s) => s.sumAt((t) => sum(t.earned), 777)
  }),
  one("curioso-1337", "curiosidades", "💻", "Elite 1337", "Conquiste {n} troféus no total", (s) => s.total, 1337, {
    vars: { n: 1337 }, when: (s) => s.sumAt((t) => sum(t.earned), 1337)
  }),
  one("curioso-2048", "curiosidades", "🔢", "2048", "Conquiste {n} troféus no total", (s) => s.total, 2048, {
    vars: { n: 2048 }, when: (s) => s.sumAt((t) => sum(t.earned), 2048)
  }),
  ...series({
    key: "curioso-ouro-jogo",
    category: "curiosidades",
    icon: "👑",
    targets: [5, 10, 15, 20, 25],
    names: ["Jogo Dourado", "Ouro Puro", "Reino Dourado", "Império Dourado", "Midas no Controle"],
    base: "Ouro no Jogo",
    describe: () => "Ganhe {n} troféus de ouro em um só jogo",
    when: (s, n) => s.nthAt((t) => t.earned.gold >= n, 1),
    value: (s) => s.maxGoldInGame,
  }),
  ...series({
    key: "curioso-trofeus-jogo",
    category: "curiosidades",
    icon: "🗻",
    targets: [50, 100, 200],
    names: ["Montanha de Troféus", "Cordilheira", "Everest"],
    base: "Troféus no Jogo",
    describe: () => "Conquiste {n} troféus em um só jogo",
    when: (s, n) => s.nthAt((t) => sum(t.earned) >= n, 1),
    value: (s) => s.maxTrophiesInGame,
  }),
  ...series({
    key: "curioso-taxa-platina",
    category: "curiosidades",
    icon: "📊",
    targets: [25, 50, 75],
    names: ["Um em Quatro", "Metade Platinada", "Platinador Nato"],
    base: "Taxa de Platina",
    describe: () => "Platine {n}% dos seus jogos (a partir de 4 jogos)",
    value: (s) => s.platinumRate,
  }),
  ...series({
    key: "curioso-media-trofeus",
    category: "curiosidades",
    icon: "🧮",
    targets: [20, 40],
    names: ["Média Caprichada", "Média de Respeito"],
    base: "Média de Troféus",
    describe: () => "Tenha média de {n} troféus por jogo",
    value: (s) => s.avgTrophiesPerGame,
  }),
  ...series({
    key: "curioso-equilibrio",
    category: "curiosidades",
    icon: "⚖️",
    targets: [10, 50, 100, 250, 500, 1000],
    base: "Equilíbrio",
    describe: () => "Tenha {n} troféus de ouro, de prata e de bronze",
    value: (s) => Math.min(s.earned.gold, s.earned.silver, s.earned.bronze),
  }),
  // Especiais
  one("especial-plus", "especiais", "➕", "Assinante", "Tenha PlayStation Plus", (s) => has(s.isPlus)),
  one("especial-sobre", "especiais", "📝", "Apresentado", "Preencha o \"Sobre mim\" do perfil da PSN", (s) => has(s.hasAboutMe)),
  one("especial-platina-completo", "especiais", "🌟", "Platina e Algo Mais", "Tenha mais jogos 100% do que platinas (DLCs completos)", (s) =>
    has(s.completed > 0 && s.completed > s.earned.platinum)),
  one("especial-sem-bronze", "especiais", "🎩", "Fino Trato", "Tenha mais troféus de ouro do que de bronze", (s) => has(s.earned.gold > s.earned.bronze)),
  one("especial-prata-ouro", "especiais", "🪙", "Prata da Casa", "Tenha mais troféus de prata do que de ouro", (s) => has(s.earned.silver > s.earned.gold)),
  one("especial-mil-e-platina", "especiais", "🏅", "Pacote Completo", "Tenha {a} troféus, {b} platinas e nível {c}", (s) =>
    [s.total >= 1000, s.earned.platinum >= 10, (s.level ?? 0) >= 100].filter(Boolean).length, 3, {
    vars: { a: 1000, b: 10, c: 100 },
  }),
];

/** Valor de um número dos desafios (null quando não há dados: méritos de um amigo). */
const ch = (pick: (c: ChallengeStats) => number) => (s: MeritStats) => (s.challenges ? pick(s.challenges) : null);

/** Méritos dos Desafios (60): criar, vencer, subir ao pódio, derrotar rivais. */
const CHALLENGE_MERITS: Merit[] = [
  ...series({
    key: "desafio-criados",
    category: "desafios",
    icon: "🏁",
    targets: [1, 3, 5, 10, 25, 50, 100],
    names: ["Desafiante", "Provocador", "Organizador", "Juiz da Arena", "Mestre de Cerimônias", "Comissário", "Liga Própria"],
    base: "Desafios Criados",
    describe: (n) => plural(n, "Crie {n} desafio", "Crie {n} desafios"),
    value: ch((c) => c.created),
  }),
  ...series({
    key: "desafio-vitorias",
    category: "desafios",
    icon: "🥇",
    targets: [1, 3, 5, 10, 20, 30, 50, 75, 100, 150],
    names: ["Primeira Vitória", "Tricampeão", "Pentacampeão", "Dezena de Ouro", "Imbatível", "Dominante", "Campeão da Liga", "Lenda da Arena", "Centenário", "Invencível"],
    base: "Vitórias",
    describe: (n) =>
      plural(
        n,
        "Vença {n} desafio (seja o primeiro a conquistar o troféu)",
        "Vença {n} desafios (seja o primeiro a conquistar o troféu)",
      ),
    value: ch((c) => c.wins),
  }),
  ...series({
    key: "desafio-podios",
    category: "desafios",
    icon: "🏅",
    targets: [1, 5, 10, 25, 50],
    names: ["No Pódio", "Frequentador do Pódio", "Sempre Entre os Três", "Dono do Pódio", "Pódio Cativo"],
    base: "Pódios",
    describe: (n) => plural(n, "Termine {n} desafio entre os 3 primeiros", "Termine {n} desafios entre os 3 primeiros"),
    value: ch((c) => c.podiums),
  }),
  ...series({
    key: "desafio-concluidos",
    category: "desafios",
    icon: "✅",
    targets: [1, 5, 10, 25, 50, 100],
    names: ["Missão Cumprida", "Cumpridor", "Persistente", "Incansável", "Obstinado", "Cem Missões"],
    base: "Desafios Cumpridos",
    describe: (n) =>
      plural(n, "Conquiste o troféu de {n} desafio dentro do desafio", "Conquiste o troféu de {n} desafios dentro do desafio"),
    value: ch((c) => c.completed),
  }),
  ...series({
    key: "desafio-rivais",
    category: "desafios",
    icon: "⚔️",
    targets: [1, 3, 5, 10, 20, 50],
    names: ["Rival à Vista", "Trio de Rivais", "Lista de Rivais", "Arquirrivais", "Torneio Aberto", "Contra Todos"],
    base: "Rivais",
    describe: (n) => plural(n, "Desafie {n} amigo diferente", "Desafie {n} amigos diferentes"),
    value: ch((c) => c.rivals),
  }),
  ...series({
    key: "desafio-derrotados",
    category: "desafios",
    icon: "💥",
    targets: [1, 3, 5, 10, 25],
    names: ["Primeiro Derrotado", "Três no Chão", "Cinco Superados", "Dez Superados", "Rei da Arena"],
    base: "Rivais Superados",
    describe: (n) => plural(n, "Vença {n} amigo diferente em desafios", "Vença {n} amigos diferentes em desafios"),
    value: ch((c) => c.defeated),
  }),
  ...series({
    key: "desafio-platina",
    category: "desafios",
    icon: "🏆",
    targets: [1, 3, 5, 10, 25],
    names: ["Corrida da Platina", "Platina na Frente", "Cinco Corridas", "Dez Corridas", "Senhor das Platinas"],
    base: "Corrida da Platina",
    describe: (n) => plural(n, "Vença {n} desafio de platina", "Vença {n} desafios de platina"),
    value: ch((c) => c.platinumWins),
  }),
  ...series({
    key: "desafio-ouro",
    category: "desafios",
    icon: "🪙",
    targets: [1, 5, 10],
    names: ["Corrida do Ouro", "Garimpeiro Veloz", "Febre do Ouro"],
    base: "Corrida do Ouro",
    describe: (n) => plural(n, "Vença {n} desafio de troféu de ouro", "Vença {n} desafios de troféu de ouro"),
    value: ch((c) => c.goldWins),
  }),
  ...series({
    key: "desafio-sequencia",
    category: "desafios",
    icon: "🔥",
    targets: [2, 3, 5, 7, 10],
    names: ["Embalado", "Em Chamas", "Sequência Quente", "Semana Perfeita", "Dez Seguidas"],
    base: "Sequência",
    describe: () => "Vença {n} desafios seguidos",
    value: ch((c) => c.bestStreak),
  }),
  ...series({
    key: "desafio-jogos",
    category: "desafios",
    icon: "🎮",
    targets: [1, 5, 10, 25],
    names: ["Campeão de um Jogo", "Versátil", "Multicampeão", "Campeão Universal"],
    base: "Jogos Vencidos",
    describe: (n) => plural(n, "Vença desafios em {n} jogo diferente", "Vença desafios em {n} jogos diferentes"),
    value: ch((c) => c.gamesWon),
  }),
  one("desafio-relampago", "desafios", "⚡", "Relâmpago", "Vença um desafio em menos de 24 horas", ch((c) =>
    has(c.fastestWinHours !== null && c.fastestWinHours < 24))),
  one("desafio-multidao", "desafios", "🏟️", "Multidão", "Vença um desafio com 5 ou mais jogadores", ch((c) => c.bigWins)),
  one("desafio-raridade", "desafios", "💎", "Caçador de Raridades", "Vença um desafio por um troféu com menos de 5% dos jogadores", ch((c) => c.rareWins)),
  one("desafio-no-prazo", "desafios", "⏳", "Contra o Relógio", "Conquiste o troféu de um desafio com prazo dentro do prazo", ch((c) => c.onTime)),
];


/** Marcos numerados (nome com o número, ex.: "Marco de Platinas: 350"), só nas metas que a série principal não tem. */
function ladder(opts: {
  key: string;
  category: string;
  icon: string;
  targets: number[];
  skip: number[];
  name: string;
  describe: (n: number) => string;
  /** Outros campos do nome e da descrição (ex.: "{p}", a plataforma). */
  vars?: Record<string, MeritVar>;
  value: Merit["value"];
  when?: (s: MeritStats, n: number) => number | null;
}): Merit[] {
  return opts.targets
    .filter((n) => !opts.skip.includes(n))
    .map((target) => ({
      id: `${opts.key}-${target}`,
      category: opts.category,
      icon: opts.icon,
      name: opts.name,
      nameVars: { n: target, ...opts.vars },
      description: opts.describe(target),
      vars: { n: target, ...opts.vars },
      target,
      value: opts.value,
      ...(opts.when ? { when: (s: MeritStats) => opts.when!(s, target) } : {}),
    }));
}

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** Nome do mês / dia da semana no idioma do app (na hora de mostrar). */
const monthName = (m: number) => () => new Intl.DateTimeFormat(locale(), { month: "long" }).format(new Date(2020, m, 1));
// 2023-01-01 foi um domingo.
const weekdayName = (d: number) => () => new Intl.DateTimeFormat(locale(), { weekday: "long" }).format(new Date(2023, 0, 1 + d));
const PERIODS = ["Madrugada", "Manhã", "Tarde", "Noite"] as const;
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const genre = (s: MeritStats, id: string) => s.genres.get(id);
const hourOf = (s: MeritStats, t: Title) => new Date(s.timeOf(t)).getHours();

/** Méritos de gêneros: jogos, platinas, 100%, troféus, horas, média e ouro em cada gênero. */
const GENRE_MERITS: Merit[] = GENRES.flatMap((g) => {
  const label = () => t(g.label);
  const inGenre = (s: MeritStats, x: Title) => s.genresOf(x).includes(g.id);
  return [
    ...series({
      key: `genero-${g.id}-jogos`,
      category: "generos",
      icon: g.icon,
      targets: [1, 3, 5, 10, 15, 20, 25, 30, 40, 50],
      base: "Fã de {g}",
      baseVars: { g: label },
      describe: (n) => plural(n, "Tenha troféus em {n} jogo de {g}", "Tenha troféus em {n} jogos de {g}"),
      vars: { g: label },
      value: (s) => genre(s, g.id)?.games ?? 0,
      when: (s, n) => s.nthAt((x) => inGenre(s, x), n),
    }),
    ...series({
      key: `genero-${g.id}-platinas`,
      category: "generos",
      icon: "🏆",
      targets: [1, 2, 3, 5, 10, 15, 20, 25],
      base: "Platina em {g}",
      baseVars: { g: label },
      describe: (n) => plural(n, "Conquiste {n} platina em jogos de {g}", "Conquiste {n} platinas em jogos de {g}"),
      vars: { g: label },
      value: (s) => genre(s, g.id)?.platinums ?? 0,
      when: (s, n) => s.nthAt((x) => inGenre(s, x) && x.earned.platinum > 0, n),
    }),
    ...series({
      key: `genero-${g.id}-completos`,
      category: "generos",
      icon: "💯",
      targets: [1, 3, 5, 10],
      base: "Perfeição em {g}",
      baseVars: { g: label },
      describe: (n) => plural(n, "Complete {n} jogo de {g} em 100%", "Complete {n} jogos de {g} em 100%"),
      vars: { g: label },
      value: (s) => genre(s, g.id)?.completed ?? 0,
      when: (s, n) => s.nthAt((x) => inGenre(s, x) && isComplete(x), n),
    }),
    ...series({
      key: `genero-${g.id}-trofeus`,
      category: "generos",
      icon: "🎖️",
      targets: [50, 100, 250, 500, 1000, 2500],
      base: "Troféus de {g}",
      baseVars: { g: label },
      describe: () => "Conquiste {n} troféus em jogos de {g}",
      vars: { g: label },
      value: (s) => genre(s, g.id)?.trophies ?? 0,
      when: (s, n) => s.sumAt((x) => (inGenre(s, x) ? sum(x.earned) : 0), n),
    }),
    ...series({
      key: `genero-${g.id}-horas`,
      category: "generos",
      icon: "⏱️",
      targets: [10, 50, 100, 250, 500],
      base: "Horas de {g}",
      baseVars: { g: label },
      describe: () => "Jogue {n} horas em jogos de {g} (PS4 e PS5)",
      vars: { g: label },
      value: (s) => Math.floor(genre(s, g.id)?.hours ?? 0),
    }),
    ...series({
      key: `genero-${g.id}-media`,
      category: "generos",
      icon: "📈",
      targets: [50, 75],
      base: "Domínio de {g}",
      baseVars: { g: label },
      describe: () => "Tenha conclusão média de {n}% em jogos de {g} (a partir de 3 jogos)",
      vars: { g: label },
      value: (s) => {
        const x = genre(s, g.id);
        return x && x.games >= 3 ? Math.round(x.progressSum / x.games) : 0;
      },
    }),
    ...series({
      key: `genero-${g.id}-ouro`,
      category: "generos",
      icon: "🥇",
      targets: [10, 50, 100],
      base: "Ouro em {g}",
      baseVars: { g: label },
      describe: () => "Conquiste {n} troféus de ouro em jogos de {g}",
      vars: { g: label },
      value: (s) => genre(s, g.id)?.gold ?? 0,
      when: (s, n) => s.sumAt((x) => (inGenre(s, x) ? x.earned.gold : 0), n),
    }),
  ];
});

const EXTRA_MERITS: Merit[] = [
  ...GENRE_MERITS,
  ...series({
    key: "generos-variados",
    category: "generos",
    icon: "🎭",
    targets: [3, 5, 10, 15],
    names: ["Eclético", "Versátil", "Gosto Amplo", "Todos os Gêneros"],
    base: "Eclético",
    describe: () => "Tenha jogos de {n} gêneros diferentes",
    value: (s) => s.genres.size,
  }),
  // Temporadas: platinas, jogos e troféus em cada ano
  ...SEASONS.flatMap((y) => [
    ...series({
      key: `ano-${y}-platinas`,
      category: "temporadas",
      icon: "🏆",
      targets: [3, 5, 10],
      base: "Platinas de {y}",
      baseVars: { y: String(y) },
      describe: () => "Conquiste {n} platinas em jogos com a última conquista em {y}",
      vars: { y: String(y) },
      value: (s) => s.years.get(y)?.platinums ?? 0,
      when: (s, n) => s.nthAt((t) => yearOf(t) === y && t.earned.platinum > 0, n),
    }),
    ...series({
      key: `ano-${y}-jogos`,
      category: "temporadas",
      icon: "🗓️",
      targets: [5, 10, 25],
      base: "Jogos de {y}",
      baseVars: { y: String(y) },
      describe: () => "Tenha {n} jogos com a última conquista em {y}",
      vars: { y: String(y) },
      value: (s) => s.years.get(y)?.games ?? 0,
      when: (s, n) => s.nthAt((t) => yearOf(t) === y, n),
    }),
    ...series({
      key: `ano-${y}-trofeus`,
      category: "temporadas",
      icon: "🎖️",
      targets: [100, 500, 1000],
      base: "Troféus de {y}",
      baseVars: { y: String(y) },
      describe: () => "Conquiste {n} troféus em jogos com a última conquista em {y}",
      vars: { y: String(y) },
      value: (s) => s.years.get(y)?.trophies ?? 0,
      when: (s, n) => s.sumAt((t) => (yearOf(t) === y ? sum(t.earned) : 0), n),
    }),
  ]),
  // Calendário: meses, dias da semana e períodos do dia
  ...Array.from({ length: 12 }, (_, m) => [
    ...series({
      key: `mes-${m + 1}-jogos`,
      category: "calendario",
      icon: "📆",
      targets: [1, 5, 10, 25],
      base: "Mês de {m}",
      baseVars: { m: monthName(m) },
      describe: (n) => plural(n, "Tenha {n} jogo com a última conquista em {m}", "Tenha {n} jogos com a última conquista em {m}"),
      vars: { m: monthName(m) },
      value: (s) => s.months[m].games,
      when: (s, n) => s.nthAt((t) => new Date(s.timeOf(t)).getMonth() === m, n),
    }),
    ...series({
      key: `mes-${m + 1}-platinas`,
      category: "calendario",
      icon: "🏆",
      targets: [1, 3, 5],
      base: "Platina em {m}",
      baseVars: { m: monthName(m) },
      describe: (n) => plural(n, "Conquiste {n} platina em {m}", "Conquiste {n} platinas em {m}"),
      vars: { m: monthName(m) },
      value: (s) => s.months[m].platinums,
      when: (s, n) => s.nthAt((t) => new Date(s.timeOf(t)).getMonth() === m && t.earned.platinum > 0, n),
    }),
  ]).flat(),
  ...Array.from({ length: 7 }, (_, d) => [
    ...series({
      key: `semana-${d}-platinas`,
      category: "calendario",
      icon: "🏆",
      targets: [1, 5, 10],
      base: "Platina de {d}",
      baseVars: { d: weekdayName(d) },
      describe: (n) => plural(n, "Conquiste {n} platina no dia da semana: {d}", "Conquiste {n} platinas no dia da semana: {d}"),
      vars: { d: weekdayName(d) },
      value: (s) => s.weekdays[d].platinums,
      when: (s, n) => s.nthAt((t) => new Date(s.timeOf(t)).getDay() === d && t.earned.platinum > 0, n),
    }),
    ...series({
      key: `semana-${d}-jogos`,
      category: "calendario",
      icon: "📅",
      targets: [5, 25],
      base: "Jogador de {d}",
      baseVars: { d: weekdayName(d) },
      describe: () => "Tenha {n} jogos com a última conquista no dia da semana: {d}",
      vars: { d: weekdayName(d) },
      value: (s) => s.weekdays[d].games,
      when: (s, n) => s.nthAt((t) => new Date(s.timeOf(t)).getDay() === d, n),
    }),
  ]).flat(),
  ...PERIODS.flatMap((label, i) => [
    ...series({
      key: `periodo-${i}-platinas`,
      category: "calendario",
      icon: ["🌙", "🌅", "☀️", "🌆"][i],
      targets: [1, 5, 10, 25],
      base: "Platinas: {p}",
      baseVars: { p: () => t(label) },
      describe: (n) => plural(n, "Conquiste {n} platina no período: {p}", "Conquiste {n} platinas no período: {p}"),
      vars: { p: () => t(label) },
      value: (s) => s.periods[i].platinums,
      when: (s, n) => s.nthAt((t) => Math.floor(hourOf(s, t) / 6) === i && t.earned.platinum > 0, n),
    }),
    ...series({
      key: `periodo-${i}-jogos`,
      category: "calendario",
      icon: ["🌙", "🌅", "☀️", "🌆"][i],
      targets: [10, 50],
      base: "Turno: {p}",
      baseVars: { p: () => t(label) },
      describe: () => "Tenha {n} jogos com a última conquista no período: {p}",
      vars: { p: () => t(label) },
      value: (s) => s.periods[i].games,
      when: (s, n) => s.nthAt((t) => Math.floor(hourOf(s, t) / 6) === i, n),
    }),
  ]),
  // Plataformas: ouro, prata e bronze, média e jogos acima de 50% em cada uma
  ...PLATFORMS.flatMap((p) => {
    const tag = p === "PS Vita" ? "Vita" : p;
    const category = { PS5: "ps5", PS4: "ps4", PS3: "ps3", "PS Vita": "vita" }[p];
    const type = (key: "gold" | "silver" | "bronze", name: string, desc: string, icon: string) =>
      series({
        key: `${category}-${key}`,
        category,
        icon,
        targets: [10, 50, 100, 250, 500],
        base: name,
        baseVars: { p: tag },
        describe: () => desc,
        vars: { p },
        value: (s) => platform(s, p)?.[key] ?? 0,
        when: (s, n) => s.sumAt((t) => (s.platformOf(t) === p ? t.earned[key] : 0), n),
      });
    return [
      ...type("gold", "Ouro {p}", "Conquiste {n} troféus de ouro no {p}", "🥇"),
      ...type("silver", "Prata {p}", "Conquiste {n} troféus de prata no {p}", "🥈"),
      ...type("bronze", "Bronze {p}", "Conquiste {n} troféus de bronze no {p}", "🥉"),
      ...series({
        key: `${category}-media`,
        category,
        icon: "📈",
        targets: [50, 75, 90],
        base: "Média {p}",
        baseVars: { p: tag },
        describe: () => "Tenha conclusão média de {n}% nos jogos de {p}",
        vars: { p },
        value: (s) => {
          const x = platform(s, p);
          return x?.games ? Math.round(x.progressSum / x.games) : 0;
        },
      }),
      ...series({
        key: `${category}-metade`,
        category,
        icon: "🧭",
        targets: [5, 25, 50],
        base: "Dedicação {p}",
        baseVars: { p: tag },
        describe: () => "Passe de 50% em {n} jogos de {p}",
        vars: { p },
        value: (s) => platform(s, p)?.half ?? 0,
        when: (s, n) => s.nthAt((t) => s.platformOf(t) === p && t.progress >= 50, n),
      }),
    ];
  }),
  // Alfabeto
  ...LETTERS.map((l) =>
    one(`letra-platina-${l}`, "alfabeto", "🔤", "Letra {l}", "Platine um jogo que comece com a letra {l}", (s) =>
      has(s.platinumLetters.has(l)), 1, {
      nameVars: { l },
      vars: { l },
      when: (s) => s.nthAt((t) => t.earned.platinum > 0 && initialOf(t.name) === l, 1),
    }),
  ),
  ...LETTERS.map((l) =>
    one(`letra-jogo-${l}`, "alfabeto", "🔠", "Inicial {l}", "Tenha troféus em um jogo que comece com a letra {l}", (s) =>
      has(s.letters.has(l)), 1, {
      nameVars: { l },
      vars: { l },
      when: (s) => s.nthAt((t) => initialOf(t.name) === l, 1),
    }),
  ),
  ...series({
    key: "alfabeto",
    category: "alfabeto",
    icon: "📖",
    targets: [5, 10, 15, 20, 26],
    names: ["Abecedário", "Dicionário", "Enciclopédia", "Quase Tudo", "De A a Z"],
    base: "Alfabeto",
    describe: () => "Tenha jogos começando com {n} letras diferentes",
    value: (s) => s.letters.size,
  }),
  // Conclusão em degraus e jogos marcantes
  ...[10, 20, 30, 40, 60, 70, 80, 90].flatMap((x) =>
    series({
      key: `acima-${x}`,
      category: "conclusao",
      icon: "📶",
      targets: [1, 5, 10, 25, 50, 100],
      base: "Acima de {x}%",
      baseVars: { x },
      describe: (n) => plural(n, "Passe de {x}% em {n} jogo", "Passe de {x}% em {n} jogos"),
      vars: { x },
      value: (s) => s.gamesAtLeast(x),
      when: (s, n) => s.nthAt((t) => t.progress >= x, n),
    }),
  ),
  ...[10, 25, 75, 150].flatMap((x) =>
    series({
      key: `jogo-${x}-trofeus`,
      category: "colecao",
      icon: "🎯",
      targets: [1, 5, 10, 25, 50],
      base: "Jogo com {x} Troféus",
      baseVars: { x },
      describe: (n) =>
        plural(n, "Tenha {n} jogo com {x} troféus ou mais conquistados", "Tenha {n} jogos com {x} troféus ou mais conquistados"),
      vars: { x },
      value: (s) => s.gamesWithTrophies(x),
      when: (s, n) => s.nthAt((t) => sum(t.earned) >= x, n),
    }),
  ),
  ...[1, 5, 10].flatMap((x) =>
    series({
      key: `jogo-${x}-ouros`,
      category: "ouro",
      icon: "👑",
      targets: [5, 10, 25, 50],
      base: "Jogos de Ouro ({x}+)",
      baseVars: { x },
      describe: () => "Tenha {n} jogos com {x} troféus de ouro ou mais",
      vars: { x },
      value: (s) => s.gamesWithGold(x),
      when: (s, n) => s.nthAt((t) => t.earned.gold >= x, n),
    }),
  ),
  // Marcos numerados
  ...ladder({
    key: "nivel",
    category: "marcos",
    icon: "⭐",
    targets: range(10, 990, 10),
    skip: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900],
    name: "Nível {n}",
    describe: () => "Chegue ao nível {n} da PSN",
    value: (s) => s.level,
  }),
  ...ladder({
    key: "platinas",
    category: "marcos",
    icon: "🏆",
    targets: range(10, 1000, 10),
    skip: [10, 20, 30, 40, 50, 60, 90, 100, 150, 200, 250, 300, 400, 500],
    name: "Marco de Platinas: {n}",
    describe: () => "Conquiste {n} platinas",
    value: (s) => s.earned.platinum,
    when: (s, n) => s.nthAt((t) => t.earned.platinum > 0, n),
  }),
  ...ladder({
    key: "trofeus",
    category: "marcos",
    icon: "🎖️",
    targets: range(1000, 50000, 1000),
    skip: [1000, 2000, 3000, 4000, 5000, 6000, 9000, 10000, 15000, 20000, 25000],
    name: "Marco de Troféus: {n}",
    describe: () => "Conquiste {n} troféus no total",
    value: (s) => s.total,
    when: (s, n) => s.sumAt((t) => sum(t.earned), n),
  }),
  ...ladder({
    key: "ouro",
    category: "marcos",
    icon: "🥇",
    targets: range(50, 2500, 50),
    skip: [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000],
    name: "Marco de Ouro: {n}",
    describe: () => "Conquiste {n} troféus de ouro",
    value: (s) => s.earned.gold,
    when: (s, n) => s.sumAt((t) => t.earned.gold, n),
  }),
  ...ladder({
    key: "prata",
    category: "marcos",
    icon: "🥈",
    targets: range(100, 5000, 100),
    skip: [100, 200, 300, 400, 500, 1000, 1500, 2000, 2500, 3500, 5000],
    name: "Marco de Prata: {n}",
    describe: () => "Conquiste {n} troféus de prata",
    value: (s) => s.earned.silver,
    when: (s, n) => s.sumAt((t) => t.earned.silver, n),
  }),
  ...ladder({
    key: "bronze",
    category: "marcos",
    icon: "🥉",
    targets: range(500, 20000, 500),
    skip: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000],
    name: "Marco de Bronze: {n}",
    describe: () => "Conquiste {n} troféus de bronze",
    value: (s) => s.earned.bronze,
    when: (s, n) => s.sumAt((t) => t.earned.bronze, n),
  }),
  ...ladder({
    key: "colecao",
    category: "marcos",
    icon: "📚",
    targets: range(50, 1500, 50),
    skip: [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000],
    name: "Marco da Coleção: {n}",
    describe: () => "Tenha troféus em {n} jogos",
    value: (s) => s.games,
    when: (s, n) => s.nthAt(() => true, n),
  }),
  ...series({
    key: "continuacoes",
    category: "colecao",
    icon: "🔁",
    targets: [1, 5, 10],
    base: "Continuações",
    describe: (n) =>
      plural(n, "Tenha troféus em {n} jogo com número no nome (continuação)", "Tenha troféus em {n} jogos com número no nome (continuações)"),
    value: (s) => s.sequels,
    when: (s, n) => s.nthAt((t) => SEQUEL.test(t.name), n),
  }),
];

const MERITS_2000: Merit[] = [...BASE_MERITS, ...CHALLENGE_MERITS, ...EXTRA_MERITS];
const TAKEN = new Set(MERITS_2000.map((m) => m.id));
/** Ladder só com as metas cujo id ainda não existe (as séries e marcos de antes continuam iguais). */
const more = (opts: Parameters<typeof ladder>[0]) => ladder({ ...opts, skip: [] }).filter((m) => !TAKEN.has(m.id));

/** Méritos novos (de 2.000 para 5.000): marcos intermediários e marcos de horas, 100%, DLCs, social e plataformas. */
const MORE_MERITS: Merit[] = [
  // Os mesmos marcos de antes, com metas no meio do caminho e mais longe.
  ...more({
    key: "nivel",
    category: "marcos",
    icon: "⭐",
    targets: range(5, 995, 5),
    skip: [],
    name: "Nível {n}",
    describe: () => "Chegue ao nível {n} da PSN",
    value: (s) => s.level,
  }),
  ...more({
    key: "platinas",
    category: "marcos",
    icon: "🏆",
    targets: range(5, 2000, 5),
    skip: [],
    name: "Marco de Platinas: {n}",
    describe: () => "Conquiste {n} platinas",
    value: (s) => s.earned.platinum,
    when: (s, n) => s.nthAt((t) => t.earned.platinum > 0, n),
  }),
  ...more({
    key: "trofeus",
    category: "marcos",
    icon: "🎖️",
    targets: range(500, 100000, 500),
    skip: [],
    name: "Marco de Troféus: {n}",
    describe: () => "Conquiste {n} troféus no total",
    value: (s) => s.total,
    when: (s, n) => s.sumAt((t) => sum(t.earned), n),
  }),
  ...more({
    key: "ouro",
    category: "marcos",
    icon: "🥇",
    targets: range(25, 5000, 25),
    skip: [],
    name: "Marco de Ouro: {n}",
    describe: () => "Conquiste {n} troféus de ouro",
    value: (s) => s.earned.gold,
    when: (s, n) => s.sumAt((t) => t.earned.gold, n),
  }),
  ...more({
    key: "prata",
    category: "marcos",
    icon: "🥈",
    targets: range(50, 10000, 50),
    skip: [],
    name: "Marco de Prata: {n}",
    describe: () => "Conquiste {n} troféus de prata",
    value: (s) => s.earned.silver,
    when: (s, n) => s.sumAt((t) => t.earned.silver, n),
  }),
  ...more({
    key: "bronze",
    category: "marcos",
    icon: "🥉",
    targets: range(250, 50000, 250),
    skip: [],
    name: "Marco de Bronze: {n}",
    describe: () => "Conquiste {n} troféus de bronze",
    value: (s) => s.earned.bronze,
    when: (s, n) => s.sumAt((t) => t.earned.bronze, n),
  }),
  ...more({
    key: "colecao",
    category: "marcos",
    icon: "📚",
    targets: range(10, 3000, 10),
    skip: [],
    name: "Marco da Coleção: {n}",
    describe: () => "Tenha troféus em {n} jogos",
    value: (s) => s.games,
    when: (s, n) => s.nthAt(() => true, n),
  }),
  // Marcos novos
  ...more({
    key: "marco-horas",
    category: "marcos",
    icon: "⏱️",
    targets: range(50, 12750, 50),
    skip: [],
    name: "Marco de Horas: {n}",
    describe: () => "Jogue {n} horas no total (PS4 e PS5)",
    value: (s) => s.playHours,
  }),
  ...more({
    key: "marco-100",
    category: "marcos",
    icon: "💯",
    targets: range(5, 1000, 5),
    skip: [],
    name: "Marco de 100%: {n}",
    describe: () => "Complete {n} jogos em 100%",
    value: (s) => s.completed,
    when: (s, n) => s.nthAt(isComplete, n),
  }),
  ...more({
    key: "marco-dlc",
    category: "marcos",
    icon: "🧩",
    targets: range(5, 500, 5),
    skip: [],
    name: "Marco de DLCs: {n}",
    describe: () => "Tenha troféus em {n} jogos com DLC",
    value: (s) => s.dlcGames,
  }),
  ...more({
    key: "marco-amigos",
    category: "marcos",
    icon: "🤝",
    targets: range(10, 1000, 10),
    skip: [],
    name: "Marco Social: {n}",
    describe: () => "Tenha {n} amigos na PSN",
    value: (s) => s.friends,
  }),
  ...more({
    key: "marco-curtidas",
    category: "marcos",
    icon: "❤️",
    targets: range(50, 5000, 50),
    skip: [],
    name: "Marco de Curtidas: {n}",
    describe: () => "Curta {n} conquistas nas Atividades",
    value: (s) => s.reactions,
  }),
  // Marcos de cada plataforma
  ...PLATFORMS.flatMap((p) => {
    const tag = p === "PS Vita" ? "Vita" : p;
    const key = p === "PS Vita" ? "vita" : p.toLowerCase();
    const on = (s: MeritStats, t: Title) => s.platformOf(t) === p;
    return [
      ...more({
        key: `marco-${key}-jogos`,
        category: "marcos",
        icon: "🎮",
        targets: range(25, 1500, 25),
        skip: [],
        name: "Biblioteca {p}: {n}",
        vars: { p: tag },
        describe: () => "Tenha troféus em {n} jogos de {p}",
        value: (s) => platform(s, p)?.games ?? 0,
        when: (s, n) => s.nthAt((t) => on(s, t), n),
      }),
      ...more({
        key: `marco-${key}-platinas`,
        category: "marcos",
        icon: "💎",
        targets: range(5, 500, 5),
        skip: [],
        name: "Platinas {p}: {n}",
        vars: { p: tag },
        describe: () => "Conquiste {n} platinas no {p}",
        value: (s) => platform(s, p)?.platinums ?? 0,
        when: (s, n) => s.nthAt((t) => on(s, t) && t.earned.platinum > 0, n),
      }),
      ...more({
        key: `marco-${key}-trofeus`,
        category: "marcos",
        icon: "🎖️",
        targets: range(250, 22000, 250),
        skip: [],
        name: "Troféus {p}: {n}",
        vars: { p: tag },
        describe: () => "Conquiste {n} troféus no {p}",
        value: (s) => platform(s, p)?.trophies ?? 0,
        when: (s, n) => s.sumAt((t) => (on(s, t) ? sum(t.earned) : 0), n),
      }),
    ];
  }),
];

export const MERITS: Merit[] = [...MERITS_2000, ...MORE_MERITS];

/** Avalia todos os méritos para um jogador. Méritos sem dado (null) ficam de fora. */
export function evaluateMerits(ctx: MeritContext): MeritResult[] {
  const stats = meritStats(ctx);
  return MERITS.flatMap((merit) => {
    const value = merit.value(stats);
    if (value === null) return [];
    const done = value >= merit.target;
    const at = done && merit.when ? merit.when(stats) : null;
    return [{ merit, value, done, ratio: done ? 1 : Math.max(0, Math.min(1, value / merit.target)), at }];
  });
}
