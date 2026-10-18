import { t } from "../i18n";
import type { Counts, Profile, Title } from "../psn/types";
import type { ChallengeStats } from "./challenges";
import { isComplete, primaryPlatform, withEarnedTrophies, type PlayedOn } from "./stats";

/**
 * Méritos: conquistas do próprio app, liberadas quando o jogador atinge
 * objetivos definidos aqui (platinas, troféus, nível, tempo de jogo...).
 * Tudo é calculado no celular a partir dos dados da PSN e dos desafios
 * salvos no app. São 560 méritos.
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

export interface Merit {
  id: string;
  category: string;
  icon: string;
  /** Nome em português (chave de tradução); `nameVars` preenche "{p}" / "{y}". */
  name: string;
  nameVars?: Record<string, string | number>;
  /** Numeral romano dos méritos de série sem nome próprio (ex.: "VII" em "Lenda Platinada VII"). */
  suffix?: string;
  /** Descrição em português (chave de tradução); `vars` preenche "{n}" (a meta), "{p}"... */
  description: string;
  vars?: Record<string, string | number>;
  target: number;
  /** Valor atual do objetivo; null quando não dá para calcular. */
  value: (s: MeritStats) => number | null;
}

export interface MeritResult {
  merit: Merit;
  value: number | null;
  done: boolean;
  /** 0–1. */
  ratio: number;
}

/** Nome do mérito no idioma atual (ex.: "Lenda Platinada VII"). */
export function meritName(m: Merit): string {
  const name = t(m.name, m.nameVars);
  return m.suffix ? `${name} ${m.suffix}` : name;
}

/** Descrição do mérito no idioma atual, com a meta formatada (1.000 / 1,000). */
export function meritDescription(m: Merit): string {
  return t(m.description, m.vars);
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
];

interface PlatformStats {
  games: number;
  platinums: number;
  completed: number;
  trophies: number;
  hours: number;
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
    const s = platforms.get(p) ?? { games: 0, platinums: 0, completed: 0, trophies: 0, hours: 0 };
    s.games += 1;
    s.platinums += t.earned.platinum;
    s.completed += isComplete(t) ? 1 : 0;
    s.trophies += sum(t.earned);
    s.hours += hoursOf(t);
    platforms.set(p, s);
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
  };
}

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
  baseVars?: Record<string, string>;
  describe: (n: number) => string;
  vars?: Record<string, string>;
  value: Merit["value"];
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
  extra: Pick<Merit, "nameVars" | "vars"> = {},
): Merit => ({ id, category, icon, name, description, target, value, ...extra });

const has = (b: boolean) => (b ? 1 : 0);
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
    value: (s) => s.gamesAtLeast(50),
  }),
  ...series({
    key: "conclusao-75",
    category: "conclusao",
    icon: "🚀",
    targets: [1, 5, 10, 25, 50, 100],
    base: "Reta Final",
    describe: (n) => plural(n, "Passe de 75% em {n} jogo", "Passe de 75% em {n} jogos"),
    value: (s) => s.gamesAtLeast(75),
  }),
  ...series({
    key: "conclusao-25",
    category: "conclusao",
    icon: "🐢",
    targets: [1, 10, 25, 50, 100, 200],
    base: "Sem Pressa",
    describe: (n) => plural(n, "Passe de 25% em {n} jogo", "Passe de 25% em {n} jogos"),
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
    value: (s) => s.oldestYears,
  }),
  // Temporadas (por ano; vale o ano da última conquista de cada jogo)
  ...SEASONS.map((y) =>
    one(`temporada-${y}`, "temporadas", "🗓️", "Temporada {y}", "Tenha um jogo com troféus conquistados em {y}", (s) =>
      s.gamesByYear.get(y) ?? 0, 1, season(y)),
  ),
  ...SEASONS.map((y) =>
    one(`temporada-platina-${y}`, "temporadas", "🏆", "Platina de {y}", "Tenha um jogo platinado com a última conquista em {y}", (s) =>
      has(s.platinumYears.has(y)), 1, season(y)),
  ),
  ...SEASONS.map((y) =>
    one(`temporada-completo-${y}`, "temporadas", "💯", "Perfeição de {y}", "Tenha um jogo 100% com a última conquista em {y}", (s) =>
      has(s.completedYears.has(y)), 1, season(y)),
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
  one("curioso-42", "curiosidades", "🌌", "A Resposta", "Conquiste {n} troféus no total", (s) => s.total, 42, { vars: { n: 42 } }),
  one("curioso-777", "curiosidades", "🎰", "Sorte Grande", "Conquiste {n} troféus no total", (s) => s.total, 777, {
    vars: { n: 777 },
  }),
  one("curioso-1337", "curiosidades", "💻", "Elite 1337", "Conquiste {n} troféus no total", (s) => s.total, 1337, {
    vars: { n: 1337 },
  }),
  one("curioso-2048", "curiosidades", "🔢", "2048", "Conquiste {n} troféus no total", (s) => s.total, 2048, {
    vars: { n: 2048 },
  }),
  ...series({
    key: "curioso-ouro-jogo",
    category: "curiosidades",
    icon: "👑",
    targets: [5, 10, 15, 20, 25],
    names: ["Jogo Dourado", "Ouro Puro", "Reino Dourado", "Império Dourado", "Midas no Controle"],
    base: "Ouro no Jogo",
    describe: () => "Ganhe {n} troféus de ouro em um só jogo",
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

export const MERITS: Merit[] = [...BASE_MERITS, ...CHALLENGE_MERITS];

/** Avalia todos os méritos para um jogador. Méritos sem dado (null) ficam de fora. */
export function evaluateMerits(ctx: MeritContext): MeritResult[] {
  const stats = meritStats(ctx);
  return MERITS.flatMap((merit) => {
    const value = merit.value(stats);
    if (value === null) return [];
    const done = value >= merit.target;
    return [{ merit, value, done, ratio: done ? 1 : Math.max(0, Math.min(1, value / merit.target)) }];
  });
}
