import type { FeedItem, Title, TrophyRow, TrophyType } from "../psn/types";

/** Janela de tempo do feed de atividade. */
export const FEED_WINDOW_DAYS = 30;

export interface FeedSource {
  owner: FeedItem["owner"];
  title: Title;
}

/**
 * Escolhe quais pares (jogador, jogo) valem a pena consultar: só os que
 * tiveram troféus dentro da janela, os mais recentes primeiro, até `max`
 * (cada par custa duas chamadas à PSN).
 */
export function pickFeedSources(sources: FeedSource[], now: number, max: number): FeedSource[] {
  const since = now - FEED_WINDOW_DAYS * 86_400_000;
  return sources
    .filter((s) => new Date(s.title.lastUpdated).getTime() >= since)
    .sort((a, b) => new Date(b.title.lastUpdated).getTime() - new Date(a.title.lastUpdated).getTime())
    .slice(0, max);
}

/** Troféus conquistados dentro da janela, prontos para o feed. */
export function feedItemsFromTrophies(source: FeedSource, trophies: TrophyRow[], now: number): FeedItem[] {
  const since = now - FEED_WINDOW_DAYS * 86_400_000;
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

export function sortFeed(items: FeedItem[], limit = 80): FeedItem[] {
  const seen = new Set<string>();
  return items
    .filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)))
    .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
    .slice(0, limit);
}

export interface RawTrophyMeta {
  trophyId: number;
  trophyType: TrophyType;
  trophyName?: string;
  trophyDetail?: string;
  trophyIconUrl?: string;
  trophyHidden: boolean;
  trophyGroupId?: string;
}

export interface RawTrophyEarned {
  trophyId: number;
  earned?: boolean;
  earnedDateTime?: string;
  trophyEarnedRate?: string;
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
      name: m.trophyName ?? "Troféu oculto",
      detail: m.trophyDetail ?? null,
      iconUrl: m.trophyIconUrl ?? null,
      hidden: m.trophyHidden,
      groupId: m.trophyGroupId ?? "default",
      earned: !!e?.earned,
      earnedAt: e?.earned ? (e.earnedDateTime ?? null) : null,
      rate: Number.isFinite(rate) ? rate : null,
    };
  });
}
