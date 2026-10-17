import { t } from "../i18n";
import type { Counts, FeedItem, Title, TrophyRow, TrophyType } from "../psn/types";

/** Janela de tempo do feed de atividade. */
export const FEED_WINDOW_DAYS = 30;
/** As Atividades sempre trazem tudo dos últimos 7 dias, sem cortar pelo limite. */
export const FEED_MIN_DAYS = 7;
/** Teto de segurança de jogos consultados dentro dos 7 dias (limite de chamadas da PSN). */
export const FEED_MAX_RECENT_SOURCES = 150;

export interface FeedSource {
  owner: FeedItem["owner"];
  title: Title;
}

/**
 * Escolhe quais pares (jogador, jogo) valem a pena consultar: só os que
 * tiveram troféus dentro da janela, os mais recentes primeiro (cada par custa
 * duas chamadas à PSN). Todos os jogos com troféus nos últimos 7 dias entram
 * (até o teto de segurança); `max` limita só os mais antigos que isso.
 */
export function pickFeedSources(
  sources: FeedSource[],
  now: number,
  max: number,
  days: number = FEED_WINDOW_DAYS,
): FeedSource[] {
  const since = now - days * 86_400_000;
  const recentSince = now - FEED_MIN_DAYS * 86_400_000;
  const sorted = sources
    .filter((s) => new Date(s.title.lastUpdated).getTime() >= since)
    .sort((a, b) => new Date(b.title.lastUpdated).getTime() - new Date(a.title.lastUpdated).getTime());
  const recent = sorted.filter((s) => new Date(s.title.lastUpdated).getTime() >= recentSince);
  const older = sorted.filter((s) => new Date(s.title.lastUpdated).getTime() < recentSince);
  return [...recent.slice(0, FEED_MAX_RECENT_SOURCES), ...older.slice(0, Math.max(0, max - recent.length))];
}

/** Troféus conquistados dentro da janela, prontos para o feed. */
export function feedItemsFromTrophies(
  source: FeedSource,
  trophies: TrophyRow[],
  now: number,
  days: number = FEED_WINDOW_DAYS,
): FeedItem[] {
  const since = now - days * 86_400_000;
  const { owner, title } = source;
  return trophies
    .filter((t) => t.earned && t.earnedAt && new Date(t.earnedAt).getTime() >= since)
    .map((t) => ({
      key: `${owner.accountId}:${title.id}:${t.id}`,
      owner,
      game: { id: title.id, service: title.service, name: title.name, iconUrl: title.iconUrl, platform: title.platform },
      trophy: { id: t.id, type: t.type, name: t.name, detail: t.detail, iconUrl: t.iconUrl },
      earnedAt: t.earnedAt!,
      rate: t.rate,
    }));
}

/**
 * Ordena do mais novo, sem repetidos. Tudo dos últimos 7 dias fica; `limit`
 * só corta os troféus mais antigos que isso.
 */
export function sortFeed(items: FeedItem[], limit = 80, now: number = Date.now()): FeedItem[] {
  const seen = new Set<string>();
  const recentSince = now - FEED_MIN_DAYS * 86_400_000;
  const sorted = items
    .filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)))
    .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());
  const recent = sorted.filter((i) => new Date(i.earnedAt).getTime() >= recentSince).length;
  return sorted.slice(0, Math.max(limit, recent));
}

export interface RawTrophyMeta {
  trophyId: number;
  trophyType: TrophyType;
  trophyName?: string;
  trophyDetail?: string;
  /** Nome como veio da PSN, quando o app traduziu `trophyName`. */
  originalName?: string;
  trophyIconUrl?: string;
  trophyHidden: boolean;
  trophyGroupId?: string;
  /** Meta do contador de objetivo (PS5), em texto: "50". */
  trophyProgressTargetValue?: string;
}

export interface RawTrophyEarned {
  trophyId: number;
  earned?: boolean;
  earnedDateTime?: string;
  trophyEarnedRate?: string;
  trophyProgressTargetValue?: string;
  /** Progresso do jogador no contador, em texto: "12". A PSN manda, a psn-api não tipa. */
  progress?: string;
}

/** Contador de objetivo do troféu: meta da PSN e quanto o jogador já fez. */
export function trophyProgress(meta: RawTrophyMeta, earned?: RawTrophyEarned): TrophyRow["progress"] {
  const target = Number(meta.trophyProgressTargetValue ?? earned?.trophyProgressTargetValue);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (earned?.earned) return { current: target, target };
  const current = Number(earned?.progress);
  return { current: Number.isFinite(current) ? Math.max(0, Math.min(current, target)) : 0, target };
}

/** Junta os metadados do jogo com o status de conquista do jogador. */
export function mergeTrophies(meta: RawTrophyMeta[], earned: RawTrophyEarned[]): TrophyRow[] {
  const byId = new Map(earned.map((e) => [e.trophyId, e]));
  return meta.map((m) => {
    const e = byId.get(m.trophyId);
    const rate = e?.trophyEarnedRate !== undefined ? Number.parseFloat(e.trophyEarnedRate) : NaN;
    return {
      id: m.trophyId,
      type: m.trophyType,
      name: m.trophyName ?? t("Troféu oculto"),
      detail: m.trophyDetail ?? null,
      ...(m.originalName && m.originalName !== m.trophyName ? { originalName: m.originalName } : {}),
      iconUrl: m.trophyIconUrl ?? null,
      hidden: m.trophyHidden,
      groupId: m.trophyGroupId ?? "default",
      earned: !!e?.earned,
      earnedAt: e?.earned ? (e.earnedDateTime ?? null) : null,
      rate: Number.isFinite(rate) ? rate : null,
      progress: trophyProgress(m, e),
    };
  });
}

/** Conquistas de um jogador em um jogo, no mesmo dia (um cartão nas Atividades). */
export interface FeedGroup {
  key: string;
  owner: FeedItem["owner"];
  game: FeedItem["game"];
  /** Do mais novo para o mais antigo. */
  items: FeedItem[];
  latest: string;
  counts: Counts;
}

/** Dia local (aaaa-mm-dd) de uma data ISO. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Agrupa as conquistas por jogador, jogo e dia: em vez de um cartão por
 * troféu, um cartão por sessão de jogo. Os grupos vêm do mais recente.
 */
export function groupFeed(items: FeedItem[]): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const sorted = [...items].sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());
  for (const item of sorted) {
    const key = `${item.owner.accountId}:${item.game.id}:${localDay(item.earnedAt)}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        owner: item.owner,
        game: item.game,
        items: [],
        latest: item.earnedAt,
        counts: { platinum: 0, gold: 0, silver: 0, bronze: 0 },
      };
      groups.set(key, g);
    }
    g.items.push(item);
    g.counts[item.trophy.type] += 1;
  }
  return [...groups.values()];
}
