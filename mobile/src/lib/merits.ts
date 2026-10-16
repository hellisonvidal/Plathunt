import type { Counts, Profile, Title } from "../psn/types";
import { primaryPlatform, withEarnedTrophies, type PlayedOn } from "./stats";

/**
 * Méritos: conquistas do próprio app, liberadas quando o jogador atinge
 * objetivos definidos aqui (platinas, troféus, nível, tempo de jogo...).
 * Tudo é calculado no celular a partir dos dados da PSN.
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
  name: string;
  description: string;
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

export const MERIT_CATEGORIES: MeritCategory[] = [
  { id: "platinas", label: "Platinas", icon: "🏆" },
  { id: "trofeus", label: "Troféus", icon: "🎖️" },
  { id: "ouro", label: "Ouro", icon: "🥇" },
  { id: "prata", label: "Prata", icon: "🥈" },
  { id: "bronze", label: "Bronze", icon: "🥉" },
  { id: "nivel", label: "Nível PSN", icon: "⭐" },
  { id: "colecao", label: "Coleção", icon: "📚" },
  { id: "conclusao", label: "Conclusão", icon: "💯" },
  { id: "plataformas", label: "Plataformas", icon: "🎮" },
  { id: "tempo", label: "Tempo de jogo", icon: "⏱️" },
  { id: "assiduidade", label: "Assiduidade", icon: "📅" },
  { id: "social", label: "Social", icon: "🤝" },
  { id: "especiais", label: "Especiais", icon: "✨" },
];

/** Números já calculados uma vez, usados por todos os méritos. */
export interface MeritStats {
  earned: Counts;
  total: number;
  level: number | null;
  games: number;
  completed: number;
  avgProgress: number;
  halfDone: number;
  nearlyDone: number;
  playedPlatforms: Set<string>;
  platinumPlatforms: Set<string>;
  gamesOn: (platform: string) => number;
  playHours: number;
  maxGameHours: number;
  activeWithin: (days: number) => number;
  oldestYears: number;
  maxGoldInGame: number;
  friends: number | null;
  reactions: number | null;
  isPlus: boolean;
  hasAboutMe: boolean;
}

const DAY = 86_400_000;
const sum = (c: Counts) => c.platinum + c.gold + c.silver + c.bronze;

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
  const seconds = [...ctx.playtime.values()];
  const updated = played.map((t) => new Date(t.lastUpdated).getTime()).filter(Number.isFinite);

  return {
    earned,
    total: sum(earned),
    level: ctx.profile.level,
    games: played.length,
    completed: played.filter((t) => t.progress >= 100).length,
    avgProgress: played.length ? Math.round(played.reduce((a, t) => a + t.progress, 0) / played.length) : 0,
    halfDone: played.filter((t) => t.progress >= 50).length,
    nearlyDone: played.filter((t) => t.progress >= 90 && t.progress < 100).length,
    playedPlatforms: new Set(played.map(platformOf)),
    platinumPlatforms: new Set(played.filter((t) => t.earned.platinum > 0).map(platformOf)),
    gamesOn: (p) => played.filter((t) => platformOf(t) === p).length,
    playHours: Math.floor(seconds.reduce((a, b) => a + b, 0) / 3600),
    maxGameHours: Math.floor(Math.max(0, ...seconds) / 3600),
    activeWithin: (days) => updated.filter((at) => ctx.now - at <= days * DAY).length,
    oldestYears: updated.length ? Math.floor((ctx.now - Math.min(...updated)) / (365.25 * DAY)) : 0,
    maxGoldInGame: Math.max(0, ...played.map((t) => t.earned.gold)),
    friends: ctx.friends,
    reactions: ctx.reactions,
    isPlus: ctx.profile.isPlus,
    hasAboutMe: !!ctx.profile.aboutMe?.trim(),
  };
}

/** Gera uma série de méritos com metas crescentes. */
function tiers(
  category: string,
  icon: string,
  steps: [target: number, name: string][],
  describe: (n: string) => string,
  value: Merit["value"],
): Merit[] {
  return steps.map(([target, name]) => ({
    id: `${category}-${target}`,
    category,
    icon,
    name,
    description: describe(target.toLocaleString("pt-BR")),
    target,
    value,
  }));
}

const one = (
  id: string,
  category: string,
  icon: string,
  name: string,
  description: string,
  value: Merit["value"],
  target = 1,
): Merit => ({ id, category, icon, name, description, target, value });

const has = (b: boolean) => (b ? 1 : 0);

export const MERITS: Merit[] = [
  ...tiers(
    "platinas",
    "🏆",
    [
      [1, "Primeira Platina"],
      [5, "Mão de Platina"],
      [10, "Caçador de Platinas"],
      [25, "Colecionador Platinado"],
      [50, "Meio Centenário"],
      [75, "Brilho Eterno"],
      [100, "Centurião Platinado"],
      [150, "Lenda Platinada"],
      [200, "Mito da Platina"],
      [300, "Deus da Platina"],
    ],
    (n) => `Conquiste ${n} ${n === "1" ? "platina" : "platinas"}`,
    (s) => s.earned.platinum,
  ),
  ...tiers(
    "trofeus",
    "🎖️",
    [
      [10, "Primeiros Passos"],
      [50, "Aquecendo"],
      [100, "Centena"],
      [250, "Dedicado"],
      [500, "Meio Milhar"],
      [1000, "Milhar"],
      [2500, "Veterano"],
      [5000, "Elite"],
      [7500, "Incansável"],
      [10000, "Dez Mil"],
    ],
    (n) => `Conquiste ${n} troféus no total`,
    (s) => s.total,
  ),
  ...tiers(
    "ouro",
    "🥇",
    [
      [1, "Toque de Ouro"],
      [10, "Garimpeiro"],
      [50, "Mina de Ouro"],
      [100, "Cem Ouros"],
      [250, "Rei Midas"],
      [500, "Cofre Dourado"],
      [1000, "Tesouro Lendário"],
    ],
    (n) => `Conquiste ${n} ${n === "1" ? "troféu" : "troféus"} de ouro`,
    (s) => s.earned.gold,
  ),
  ...tiers(
    "prata",
    "🥈",
    [
      [10, "Reflexo Prateado"],
      [50, "Prataria"],
      [100, "Cem Pratas"],
      [250, "Lua de Prata"],
      [500, "Baú de Prata"],
      [1000, "Mil Pratas"],
      [2500, "Mar de Prata"],
    ],
    (n) => `Conquiste ${n} troféus de prata`,
    (s) => s.earned.silver,
  ),
  ...tiers(
    "bronze",
    "🥉",
    [
      [10, "Idade do Bronze"],
      [100, "Cem Bronzes"],
      [500, "Forja de Bronze"],
      [1000, "Mil Bronzes"],
      [2500, "Muralha de Bronze"],
      [5000, "Estátua de Bronze"],
    ],
    (n) => `Conquiste ${n} troféus de bronze`,
    (s) => s.earned.bronze,
  ),
  ...tiers(
    "nivel",
    "⭐",
    [
      [10, "Novato"],
      [25, "Aprendiz"],
      [50, "Experiente"],
      [100, "Três Dígitos"],
      [200, "Veterano da PSN"],
      [300, "Mestre"],
      [400, "Grão-Mestre"],
      [500, "Quinhentos"],
      [750, "Lendário"],
      [999, "Nível Máximo"],
    ],
    (n) => `Chegue ao nível ${n} da PSN`,
    (s) => s.level,
  ),
  ...tiers(
    "colecao",
    "📚",
    [
      [1, "Primeiro Jogo"],
      [10, "Estante"],
      [25, "Biblioteca"],
      [50, "Acervo"],
      [100, "Cem Jogos"],
      [200, "Arquivo Vivo"],
      [300, "Museu"],
      [500, "Coleção Infinita"],
    ],
    (n) => `Tenha troféus em ${n} ${n === "1" ? "jogo" : "jogos"}`,
    (s) => s.games,
  ),
  ...tiers(
    "conclusao",
    "💯",
    [
      [1, "Completista"],
      [5, "Cinco Perfeitos"],
      [10, "Dez Perfeitos"],
      [25, "Perfeccionista"],
      [50, "Obsessivo"],
      [100, "Cem por Cento"],
    ],
    (n) => `Complete ${n} ${n === "1" ? "jogo" : "jogos"} em 100%`,
    (s) => s.completed,
  ),
  one("conclusao-media-50", "conclusao", "📈", "Meio Caminho", "Tenha conclusão média de 50% ou mais", (s) => s.avgProgress, 50),
  one("conclusao-media-75", "conclusao", "📈", "Quase Completo", "Tenha conclusão média de 75% ou mais", (s) => s.avgProgress, 75),
  one("conclusao-metade-10", "conclusao", "🧭", "Não Abandona", "Passe de 50% em 10 jogos", (s) => s.halfDone, 10),
  one("conclusao-quase", "conclusao", "🎯", "Na Reta Final", "Tenha um jogo entre 90% e 99%", (s) => s.nearlyDone),
  one("plataforma-ps5", "plataformas", "🎮", "Nova Geração", "Conquiste troféus no PS5", (s) => has(s.playedPlatforms.has("PS5"))),
  one("plataforma-ps4", "plataformas", "🎮", "Geração PS4", "Conquiste troféus no PS4", (s) => has(s.playedPlatforms.has("PS4"))),
  one("plataforma-ps3", "plataformas", "🎮", "Clássico PS3", "Conquiste troféus no PS3", (s) => has(s.playedPlatforms.has("PS3"))),
  one("plataforma-vita", "plataformas", "🎮", "Portátil", "Conquiste troféus no PS Vita", (s) => has(s.playedPlatforms.has("PS Vita"))),
  one("plataforma-duas", "plataformas", "🔀", "Multiplataforma", "Conquiste troféus em 2 plataformas", (s) => s.playedPlatforms.size, 2),
  one("plataforma-todas", "plataformas", "🌐", "Todas as Gerações", "Conquiste troféus em PS3, PS4, PS5 e PS Vita", (s) =>
    ["PS3", "PS4", "PS5", "PS Vita"].filter((p) => s.playedPlatforms.has(p)).length, 4),
  one("platina-ps5", "plataformas", "💎", "Platina no PS5", "Conquiste uma platina no PS5", (s) => has(s.platinumPlatforms.has("PS5"))),
  one("platina-ps4", "plataformas", "💎", "Platina no PS4", "Conquiste uma platina no PS4", (s) => has(s.platinumPlatforms.has("PS4"))),
  one("platina-ps3", "plataformas", "💎", "Platina no PS3", "Conquiste uma platina no PS3", (s) => has(s.platinumPlatforms.has("PS3"))),
  one("platina-vita", "plataformas", "💎", "Platina no Vita", "Conquiste uma platina no PS Vita", (s) => has(s.platinumPlatforms.has("PS Vita"))),
  ...tiers(
    "tempo",
    "⏱️",
    [
      [10, "Hora de Jogar"],
      [50, "Fim de Semana Longo"],
      [100, "Cem Horas"],
      [250, "Maratonista"],
      [500, "Quinhentas Horas"],
      [1000, "Mil Horas"],
      [2500, "Sem Dormir"],
      [5000, "Vida de Gamer"],
    ],
    (n) => `Jogue ${n} horas no total (PS4 e PS5)`,
    (s) => s.playHours,
  ),
  one("tempo-jogo-100", "tempo", "🔥", "Maratona", "Jogue 100 horas em um só jogo", (s) => s.maxGameHours, 100),
  one("tempo-jogo-500", "tempo", "🔥", "Vida Dedicada", "Jogue 500 horas em um só jogo", (s) => s.maxGameHours, 500),
  one("ativo-7-1", "assiduidade", "📅", "Em Atividade", "Ganhe troféus em um jogo nos últimos 7 dias", (s) => s.activeWithin(7)),
  one("ativo-7-3", "assiduidade", "📅", "Semana Cheia", "Ganhe troféus em 3 jogos nos últimos 7 dias", (s) => s.activeWithin(7), 3),
  one("ativo-30-1", "assiduidade", "🗓️", "Presente no Mês", "Ganhe troféus em um jogo nos últimos 30 dias", (s) => s.activeWithin(30)),
  one("ativo-30-5", "assiduidade", "🗓️", "Mês Agitado", "Ganhe troféus em 5 jogos nos últimos 30 dias", (s) => s.activeWithin(30), 5),
  one("ativo-30-10", "assiduidade", "🗓️", "Mês Intenso", "Ganhe troféus em 10 jogos nos últimos 30 dias", (s) => s.activeWithin(30), 10),
  one("ativo-365-10", "assiduidade", "📆", "Ano Produtivo", "Ganhe troféus em 10 jogos no último ano", (s) => s.activeWithin(365), 10),
  one("ativo-365-25", "assiduidade", "📆", "Ano Lendário", "Ganhe troféus em 25 jogos no último ano", (s) => s.activeWithin(365), 25),
  one("ativo-365-50", "assiduidade", "📆", "Ano Sem Parar", "Ganhe troféus em 50 jogos no último ano", (s) => s.activeWithin(365), 50),
  ...tiers(
    "social",
    "🤝",
    [
      [1, "Primeiro Amigo"],
      [10, "Turma"],
      [25, "Grupo de Jogo"],
      [50, "Clã"],
      [100, "Comunidade"],
      [250, "Popular"],
    ],
    (n) => `Tenha ${n} ${n === "1" ? "amigo" : "amigos"} na PSN`,
    (s) => s.friends,
  ),
  ...[
    [1, "Primeira Curtida"],
    [10, "Incentivador"],
    [50, "Torcida"],
    [100, "Fã Número Um"],
  ].map(([target, name]) =>
    one(`curtidas-${target}`, "social", "❤️", name as string, `Curta ${target} ${target === 1 ? "conquista" : "conquistas"} nas Atividades`, (s) => s.reactions, target as number),
  ),
  one("especial-plus", "especiais", "➕", "Assinante", "Tenha PlayStation Plus", (s) => has(s.isPlus)),
  one("especial-sobre", "especiais", "📝", "Apresentado", "Preencha o \"Sobre mim\" do perfil da PSN", (s) => has(s.hasAboutMe)),
  one("especial-ouro-10", "especiais", "👑", "Ouro Puro", "Ganhe 10 troféus de ouro em um só jogo", (s) => s.maxGoldInGame, 10),
  one("especial-equilibrio", "especiais", "⚖️", "Equilíbrio", "Tenha 100 troféus de ouro, de prata e de bronze", (s) =>
    Math.min(s.earned.gold, s.earned.silver, s.earned.bronze), 100),
  one("especial-5-anos", "especiais", "🕰️", "Velha Guarda", "Tenha troféus de 5 anos atrás ou mais", (s) => s.oldestYears, 5),
  one("especial-10-anos", "especiais", "🕰️", "Década de Troféus", "Tenha troféus de 10 anos atrás ou mais", (s) => s.oldestYears, 10),
  one("especial-ps3-10", "especiais", "📀", "Retrô", "Tenha troféus em 10 jogos de PS3", (s) => s.gamesOn("PS3"), 10),
  one("especial-vita-10", "especiais", "📱", "Viciado em Portátil", "Tenha troféus em 10 jogos de PS Vita", (s) => s.gamesOn("PS Vita"), 10),
  one("especial-ps5-25", "especiais", "🚀", "Futuro Agora", "Tenha troféus em 25 jogos de PS5", (s) => s.gamesOn("PS5"), 25),
  one("especial-ps4-50", "especiais", "🧱", "Pilar do PS4", "Tenha troféus em 50 jogos de PS4", (s) => s.gamesOn("PS4"), 50),
];

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
