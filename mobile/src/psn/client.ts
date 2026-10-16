import {
  getProfileFromAccountId,
  getTitleTrophies,
  getTitleTrophyGroups,
  getUserPlayedGames,
  getUserFriendsAccountIds,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  getUserTrophyProfileSummary,
  type AuthorizationPayload,
  type TrophyTitle,
} from "psn-api";
import { cached, createLimiter, mapLimit } from "../lib/cache";
import { getSettings } from "../lib/settings";
import { parseDuration, platformFromCategory } from "../lib/stats";
import { translateTexts } from "../lib/translate";
import { feedItemsFromTrophies, mergeTrophies, pickFeedSources, sortFeed, type FeedSource } from "../lib/feed";
import { getAccessToken } from "./auth";
import type { FeedItem, PlayedGame, Profile, PsnClient, Title } from "./types";

/** Idioma dos nomes de jogos e troféus (Configurações). */
const headers = () => ({ "Accept-Language": getSettings().language });
const MIN = 60_000;
/** A PSN devolve a lista de amigos em páginas; percorremos todas. */
const FRIENDS_PAGE = 1000;
/** As Atividades olham só os primeiros amigos da lista, para não estourar o limite de chamadas da PSN. */
const FEED_FRIENDS = 60;
const MAX_FEED_SOURCES = 20;
const CONCURRENCY = 5;

type TrophyMeta = (Awaited<ReturnType<typeof getTitleTrophies>>["trophies"][number] & { originalName?: string })[];

/**
 * Nomes e descrições dos troféus no idioma das Configurações, mesmo quando a
 * Sony não tem tradução (a PSN devolve o texto original, em geral em inglês).
 * A tradução fica em cache; se o tradutor falhar, mostra o texto original.
 */
async function translatedMeta(gameId: string, meta: TrophyMeta): Promise<TrophyMeta> {
  const { autoTranslate, language } = getSettings();
  if (!autoTranslate) return meta;
  return cached(`meta-tr:${language}:${gameId}`, 30 * 24 * 60 * MIN, async () => {
    const texts = meta.flatMap((t) => [t.trophyName ?? "", t.trophyDetail ?? ""]);
    const tr = await translateTexts(texts, language);
    return meta.map((t, i) => ({
      ...t,
      trophyName: t.trophyName ? tr[2 * i] : t.trophyName,
      originalName: t.trophyName,
      trophyDetail: t.trophyDetail ? tr[2 * i + 1] : t.trophyDetail,
    }));
  }).catch(() => meta);
}

async function auth(): Promise<AuthorizationPayload> {
  return { accessToken: await getAccessToken() };
}

function pickAvatar(avatars: { size: string; url: string }[]): string | null {
  for (const size of ["l", "m", "xl", "s"]) {
    const hit = avatars.find((a) => a.size === size);
    if (hit) return hit.url;
  }
  return avatars[0]?.url ?? null;
}

function toTitle(t: TrophyTitle): Title {
  return {
    id: t.npCommunicationId,
    service: t.npServiceName,
    name: t.trophyTitleName,
    iconUrl: t.trophyTitleIconUrl ?? null,
    platform: t.trophyTitlePlatform,
    progress: t.progress,
    earned: t.earnedTrophies,
    defined: t.definedTrophies,
    lastUpdated: t.lastUpdatedDateTime,
    hasGroups: t.hasTrophyGroups,
  };
}

/** Cliente real: conversa direto com a API da PSN a partir do celular. */
export function createPsnClient(): PsnClient {
  // Telas que disparam uma chamada por amigo passam por aqui.
  const limited = createLimiter(CONCURRENCY);

  async function loadProfile(accountId: string): Promise<Profile> {
    const a = await auth();
    const profile = await getProfileFromAccountId(a, accountId);
    let summary: Awaited<ReturnType<typeof getUserTrophyProfileSummary>> | null = null;
    try {
      summary = await getUserTrophyProfileSummary(a, accountId);
    } catch {
      // Perfil de troféus privado.
    }
    return {
      accountId,
      onlineId: profile.onlineId,
      avatarUrl: pickAvatar(profile.avatars),
      aboutMe: profile.aboutMe || null,
      isPlus: profile.isPlus,
      level: summary ? Number(summary.trophyLevel) || 1 : null,
      levelProgress: summary?.progress ?? null,
      earned: summary?.earnedTrophies ?? null,
    };
  }

  const client: PsnClient = {
    async me(force) {
      return cached(
        "me",
        10 * MIN,
        async () => {
          const summary = await getUserTrophyProfileSummary(await auth(), "me");
          return loadProfile(summary.accountId);
        },
        force,
      );
    },

    async profile(accountId, force) {
      // Perfis passam pelo limitador: a lista completa de amigos pode ter centenas.
      return cached(`profile:${accountId}`, 30 * MIN, () => limited(() => loadProfile(accountId)), force);
    },

    async titles(accountId, force) {
      return cached(
        `titles:${accountId}`,
        10 * MIN,
        async () => {
          const a = await auth();
          const all: Title[] = [];
          // Todos os jogos (até 2.000), seus e dos amigos: a comparação de
          // estatísticas precisa da lista completa dos dois lados.
          for (let page = 0, offset = 0; page < 20; page++) {
            const res = await getUserTitles(a, accountId, { limit: 100, offset, headerOverrides: headers() });
            all.push(...res.trophyTitles.map(toTitle));
            if (res.nextOffset === undefined || res.trophyTitles.length === 0) break;
            offset = res.nextOffset;
          }
          return all;
        },
        force,
      );
    },

    async recentTitles(accountId, force) {
      return cached(
        `recent:${accountId}`,
        30 * MIN,
        () =>
          limited(async () => {
            const res = await getUserTitles(await auth(), accountId, { limit: 100, headerOverrides: headers() });
            return res.trophyTitles.map(toTitle);
          }),
        force,
      );
    },

    async playedGames(accountId, force) {
      return cached(
        `played:${accountId}`,
        30 * MIN,
        async () => {
          try {
            const a = await auth();
            const all: PlayedGame[] = [];
            for (let page = 0, offset = 0; page < 5; page++) {
              const res = await getUserPlayedGames(a, accountId, { limit: 200, offset });
              all.push(
                ...res.titles.map((t) => ({
                  titleId: t.titleId,
                  name: t.localizedName || t.name,
                  imageUrl: t.localizedImageUrl || t.imageUrl || null,
                  playSeconds: parseDuration(t.playDuration),
                  platform: platformFromCategory(t.category),
                  lastPlayed: t.lastPlayedDateTime ?? null,
                })),
              );
              if (!res.nextOffset || res.titles.length === 0) break;
              offset = res.nextOffset;
            }
            return all;
          } catch {
            // Perfil que não compartilha os jogos jogados.
            return null;
          }
        },
        force,
      );
    },

    async trophyGroups(game) {
      return cached(`groups:${game.id}`, 24 * 60 * MIN, async () => {
        const res = await getTitleTrophyGroups(await auth(), game.id, {
          npServiceName: game.service,
          headerOverrides: headers(),
        });
        return res.trophyGroups.map((g) => ({
          id: g.trophyGroupId,
          name: g.trophyGroupName,
          iconUrl: g.trophyGroupIconUrl ?? null,
          defined: g.definedTrophies,
        }));
      });
    },

    async gameTrophies(accountId, game, force) {
      const opts = { npServiceName: game.service, headerOverrides: headers() };
      const meta = await cached(`meta:${game.id}`, 24 * 60 * MIN, async () => {
        const res = await getTitleTrophies(await auth(), game.id, "all", opts);
        return res.trophies;
      });
      const shown = await translatedMeta(game.id, meta);
      const earned = await cached(
        `earned:${accountId}:${game.id}`,
        5 * MIN,
        async () => (await getUserTrophiesEarnedForTitle(await auth(), accountId, game.id, "all", opts)).trophies,
        force,
      );
      return mergeTrophies(shown, earned);
    },

    async friendIds(force) {
      return cached(
        "friend-ids",
        30 * MIN,
        async () => {
          const a = await auth();
          const ids: string[] = [];
          for (let offset = 0; ; ) {
            const res = await getUserFriendsAccountIds(a, "me", { limit: FRIENDS_PAGE, offset });
            ids.push(...res.friends);
            if (res.nextOffset === undefined || res.friends.length === 0 || ids.length >= res.totalItemCount) break;
            offset = res.nextOffset;
          }
          return [...new Set(ids)];
        },
        force,
      );
    },

    async friends(force) {
      const ids = await client.friendIds(force);
      const profiles = await mapLimit(ids, CONCURRENCY, (id) => client.profile(id, force).catch(() => null));
      return profiles.filter((p): p is Profile => p !== null);
    },

    async feed(force) {
      const days = getSettings().feedDays;
      return cached(
        `feed:${days}`,
        10 * MIN,
        async () => {
          const me = await client.me(force);
          const friendIds = (await client.friendIds(force)).slice(0, FEED_FRIENDS);
          const friends = (
            await mapLimit(friendIds, CONCURRENCY, (id) => client.profile(id).catch(() => null))
          ).filter((p): p is Profile => p !== null);
          const now = Date.now();

          const mine: FeedSource[] = (await client.titles("me", force)).map((title) => ({
            owner: { accountId: me.accountId, onlineId: me.onlineId, avatarUrl: me.avatarUrl, isMe: true },
            title,
          }));
          // Para amigos, só os 3 jogos mais recentes de cada um (troféus privados são ignorados).
          const theirs = (
            await mapLimit(friends, CONCURRENCY, async (f) => {
              try {
                const res = await getUserTitles(await auth(), f.accountId, { limit: 3, headerOverrides: headers() });
                return res.trophyTitles.map((t) => ({
                  owner: { accountId: f.accountId, onlineId: f.onlineId, avatarUrl: f.avatarUrl, isMe: false },
                  title: toTitle(t),
                }));
              } catch {
                return [];
              }
            })
          ).flat();

          const sources = pickFeedSources([...mine, ...theirs], now, MAX_FEED_SOURCES, days);
          const items = await mapLimit(sources, CONCURRENCY, async (s) => {
            try {
              const id = s.owner.isMe ? "me" : s.owner.accountId;
              return feedItemsFromTrophies(s, await client.gameTrophies(id, s.title, force), now, days);
            } catch {
              return [] as FeedItem[];
            }
          });
          return sortFeed(items.flat(), 80, now);
        },
        force,
      );
    },
  };

  return client;
}
