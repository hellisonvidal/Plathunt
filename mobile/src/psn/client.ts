import {
  getBasicPresence,
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
import { toPresence, UNKNOWN_PRESENCE, type RawPresence } from "../lib/presence";
import { getSettings } from "../lib/settings";
import { parseDuration, platformFromCategory } from "../lib/stats";
import { translateTexts } from "../lib/translate";
import {
  feedItemsFromTrophies,
  mergeTrophies,
  pickFeedSources,
  sortFeed,
  type FeedSource,
  type RawTrophyEarned,
} from "../lib/feed";
import { getAccessToken } from "./auth";
import type { FeedItem, PlayedGame, Presence, Profile, PsnClient, Title } from "./types";

/** Idioma dos nomes de jogos e troféus (Configurações). */
const headers = () => ({ "Accept-Language": getSettings().language });
const MIN = 60_000;
/** A PSN devolve a lista de amigos em páginas; percorremos todas. */
const FRIENDS_PAGE = 1000;
/** Nas Atividades, os jogos mais recentes de cada amigo que entram na busca. */
const FEED_GAMES_PER_FRIEND = 5;
const MAX_FEED_SOURCES = 20;
const CONCURRENCY = 5;
/** Maior página de jogos que a PSN aceita. */
const TITLES_PAGE = 800;
/** Status online: a PSN aceita vários amigos por pedido. */
const PRESENCE_BATCH = 50;
const PRESENCE_URL = "https://m.np.playstation.com/api/userProfile/v1/internal/users/basicPresences";

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

  /** Nomes, descrições e ícones dos troféus de um jogo (iguais para todo mundo). */
  async function loadMeta(game: { id: string; service: Title["service"] }) {
    const opts = { npServiceName: game.service, headerOverrides: headers() };
    const meta = await cached(`meta:${game.id}`, 24 * 60 * MIN, async () => {
      const res = await getTitleTrophies(await auth(), game.id, "all", opts);
      return res.trophies;
    });
    return translatedMeta(game.id, meta);
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
          // Todos os jogos (até 20.000), seus e dos amigos, em páginas de 800 (o
          // máximo da PSN): a comparação de estatísticas, o Boost e os Desafios
          // precisam da lista completa, e páginas grandes carregam bem mais rápido.
          for (let page = 0, offset = 0; page < 25; page++) {
            const res = await getUserTitles(a, accountId, { limit: TITLES_PAGE, offset, headerOverrides: headers() });
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
      const shown = await loadMeta(game);
      const earned = await cached(
        `earned:${accountId}:${game.id}`,
        5 * MIN,
        // A resposta traz também o "progress" dos contadores de objetivo (PS5).
        async () =>
          (await getUserTrophiesEarnedForTitle(await auth(), accountId, game.id, "all", opts)).trophies as RawTrophyEarned[],
        force,
      );
      return mergeTrophies(shown, earned);
    },

    async titleTrophies(game) {
      return mergeTrophies(await loadMeta(game), []);
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

    async presences(accountIds, force) {
      const out: Record<string, Presence> = {};
      const chunks: string[][] = [];
      for (let i = 0; i < accountIds.length; i += PRESENCE_BATCH) chunks.push(accountIds.slice(i, i + PRESENCE_BATCH));
      await mapLimit(chunks, 2, async (ids) => {
        const found = await cached(
          `presence:${ids.join(",")}`,
          2 * MIN,
          async () => {
            const result: Record<string, Presence> = {};
            try {
              // Um pedido para o grupo todo (o mesmo que o app oficial usa).
              const res = await fetch(`${PRESENCE_URL}?type=primary&accountIds=${ids.join(",")}`, {
                headers: { Authorization: `Bearer ${await getAccessToken()}` },
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const list = ((await res.json()) as { basicPresences?: RawPresence[] }).basicPresences;
              if (!Array.isArray(list)) throw new Error("sem basicPresences");
              for (const raw of list) if (raw.accountId) result[raw.accountId] = toPresence(raw);
            } catch {
              // Se o pedido em grupo falhar, pergunta amigo por amigo.
              await mapLimit(ids, CONCURRENCY, async (id) => {
                try {
                  const res = await getBasicPresence(await auth(), id);
                  result[id] = toPresence(res.basicPresence as RawPresence);
                } catch {
                  // Status escondido pela privacidade do amigo.
                }
              });
            }
            return result;
          },
          force,
        );
        Object.assign(out, found);
      });
      for (const id of accountIds) out[id] ??= UNKNOWN_PRESENCE;
      return out;
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
          const now = Date.now();
          const since = now - days * 86_400_000;

          const mine: FeedSource[] = (await client.titles("me", force)).map((title) => ({
            owner: { accountId: me.accountId, onlineId: me.onlineId, avatarUrl: me.avatarUrl, isMe: true },
            title,
          }));
          // Todos os amigos com troféus públicos: primeiro os jogos recentes de
          // cada um (perfis privados dão erro e ficam de fora); o perfil (nome e
          // avatar) só é buscado para quem jogou dentro do período.
          const friendIds = await client.friendIds(force);
          const active = (
            await mapLimit(friendIds, CONCURRENCY, async (id) => {
              try {
                const titles = (await client.recentTitles(id, force))
                  .filter((t) => new Date(t.lastUpdated).getTime() >= since)
                  .slice(0, FEED_GAMES_PER_FRIEND);
                return { id, titles };
              } catch {
                return { id, titles: [] as Title[] };
              }
            })
          ).filter((f) => f.titles.length > 0);
          const theirs = (
            await mapLimit(active, CONCURRENCY, async ({ id, titles }) => {
              const f = await client.profile(id).catch(() => null);
              if (!f) return [];
              const owner = { accountId: f.accountId, onlineId: f.onlineId, avatarUrl: f.avatarUrl, isMe: false };
              return titles.map((title) => ({ owner, title }));
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
