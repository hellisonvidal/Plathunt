import "server-only";
import {
  getTitleTrophies,
  getUserFriendsAccountIds,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  getUserTrophyProfileSummary,
  type AuthorizationPayload,
  type TrophyTitle,
} from "psn-api";
import type { User } from "@prisma/client";
import { db } from "./db";
import { getPsnAuth } from "./psn";
import { parseEarnedRate, titlesNeedingTrophySync, trophyKey } from "./sync-plan";

const HEADERS = { "Accept-Language": "pt-BR" } as const;
const MIN_INTERVAL_MS = 5 * 60 * 1000;
const MAX_TITLES_PAGES = 8; // 8 × 100 jogos
const MAX_TROPHY_SYNC_PER_RUN = 10;

export interface SyncResult {
  skipped: boolean;
  titles: number;
  newTrophies: number;
  friends: number;
}

/**
 * Sincroniza o usuário com a PSN: nível/contagem de troféus, amigos que
 * também usam o Perseus, lista de jogos e troféus conquistados (que viram
 * itens do feed social).
 */
export async function syncUser(user: User, opts: { force?: boolean } = {}): Promise<SyncResult> {
  if (!opts.force && user.lastSyncedAt && Date.now() - user.lastSyncedAt.getTime() < MIN_INTERVAL_MS) {
    return { skipped: true, titles: 0, newTrophies: 0, friends: 0 };
  }

  const auth = await getPsnAuth(user);

  const summary = await getUserTrophyProfileSummary(auth, "me");
  await db.user.update({
    where: { id: user.id },
    data: {
      trophyLevel: Number(summary.trophyLevel) || 1,
      trophyTier: summary.tier,
      bronze: summary.earnedTrophies.bronze,
      silver: summary.earnedTrophies.silver,
      gold: summary.earnedTrophies.gold,
      platinum: summary.earnedTrophies.platinum,
    },
  });

  const friends = await syncFriends(user, auth);
  const titles = await syncTitles(user, auth);
  const newTrophies = await syncEarnedTrophies(user, auth, titles);

  await db.user.update({ where: { id: user.id }, data: { lastSyncedAt: new Date() } });
  return { skipped: false, titles: titles.length, newTrophies, friends };
}

async function syncFriends(user: User, auth: AuthorizationPayload): Promise<number> {
  const accountIds: string[] = [];
  for (let offset = 0; ; ) {
    const page = await getUserFriendsAccountIds(auth, "me", { limit: 1000, offset });
    accountIds.push(...page.friends);
    if (page.nextOffset === undefined || page.friends.length === 0) break;
    offset = page.nextOffset;
  }

  const onPerseus = await db.user.findMany({
    where: { psnAccountId: { in: accountIds } },
    select: { id: true },
  });
  const friendIds = onPerseus.map((u) => u.id);

  // Amizade na PSN é mútua, então espelhamos nos dois sentidos.
  await db.$transaction([
    db.friendship.deleteMany({
      where: {
        OR: [
          { ownerId: user.id, friendId: { notIn: friendIds } },
          { friendId: user.id, ownerId: { notIn: friendIds } },
        ],
      },
    }),
    ...friendIds.flatMap((friendId) => [
      db.friendship.upsert({
        where: { ownerId_friendId: { ownerId: user.id, friendId } },
        create: { ownerId: user.id, friendId },
        update: { syncedAt: new Date() },
      }),
      db.friendship.upsert({
        where: { ownerId_friendId: { ownerId: friendId, friendId: user.id } },
        create: { ownerId: friendId, friendId: user.id },
        update: { syncedAt: new Date() },
      }),
    ]),
  ]);
  return friendIds.length;
}

async function syncTitles(user: User, auth: AuthorizationPayload): Promise<TrophyTitle[]> {
  const titles: TrophyTitle[] = [];
  for (let page = 0, offset = 0; page < MAX_TITLES_PAGES; page++) {
    const res = await getUserTitles(auth, "me", { limit: 100, offset, headerOverrides: HEADERS });
    titles.push(...res.trophyTitles);
    if (res.nextOffset === undefined || res.trophyTitles.length === 0) break;
    offset = res.nextOffset;
  }

  for (const t of titles) {
    const game = {
      npServiceName: t.npServiceName,
      name: t.trophyTitleName,
      iconUrl: t.trophyTitleIconUrl,
      platform: t.trophyTitlePlatform,
      definedBronze: t.definedTrophies.bronze,
      definedSilver: t.definedTrophies.silver,
      definedGold: t.definedTrophies.gold,
      definedPlatinum: t.definedTrophies.platinum,
    };
    const progress = {
      progress: t.progress,
      earnedBronze: t.earnedTrophies.bronze,
      earnedSilver: t.earnedTrophies.silver,
      earnedGold: t.earnedTrophies.gold,
      earnedPlatinum: t.earnedTrophies.platinum,
      lastUpdatedAt: new Date(t.lastUpdatedDateTime),
    };
    await db.$transaction([
      db.game.upsert({
        where: { npCommunicationId: t.npCommunicationId },
        create: { npCommunicationId: t.npCommunicationId, ...game },
        update: game,
      }),
      db.userTitle.upsert({
        where: { userId_npCommunicationId: { userId: user.id, npCommunicationId: t.npCommunicationId } },
        create: { userId: user.id, npCommunicationId: t.npCommunicationId, ...progress },
        update: progress,
      }),
    ]);
  }
  return titles;
}

async function syncEarnedTrophies(
  user: User,
  auth: AuthorizationPayload,
  titles: TrophyTitle[],
): Promise<number> {
  const stored = await db.userTitle.findMany({
    where: { userId: user.id },
    select: { npCommunicationId: true, trophiesSyncedAt: true },
  });
  const syncedAt = new Map(stored.map((s) => [s.npCommunicationId, s.trophiesSyncedAt]));
  const byId = new Map(titles.map((t) => [t.npCommunicationId, t]));

  const pending = titlesNeedingTrophySync(
    titles.map((t) => ({ id: t.npCommunicationId, lastUpdatedAt: new Date(t.lastUpdatedDateTime) })),
    syncedAt,
    MAX_TROPHY_SYNC_PER_RUN,
  );

  let created = 0;
  for (const id of pending) {
    const title = byId.get(id)!;
    const opts = { npServiceName: title.npServiceName, headerOverrides: HEADERS };

    const defined = title.definedTrophies;
    const totalDefined = defined.bronze + defined.silver + defined.gold + defined.platinum;
    const known = await db.trophy.count({ where: { npCommunicationId: id } });
    if (known < totalDefined) {
      const meta = await getTitleTrophies(auth, id, "all", opts);
      for (const tr of meta.trophies) {
        const data = {
          groupId: tr.trophyGroupId ?? "default",
          type: tr.trophyType,
          name: tr.trophyName ?? "Troféu oculto",
          detail: tr.trophyDetail ?? null,
          iconUrl: tr.trophyIconUrl ?? null,
          hidden: tr.trophyHidden,
        };
        await db.trophy.upsert({
          where: { id: trophyKey(id, tr.trophyId) },
          create: { id: trophyKey(id, tr.trophyId), npCommunicationId: id, trophyId: tr.trophyId, ...data },
          update: data,
        });
      }
    }

    const earned = await getUserTrophiesEarnedForTitle(auth, "me", id, "all", opts);
    for (const tr of earned.trophies) {
      if (!tr.earned || !tr.earnedDateTime) continue;
      const key = trophyKey(id, tr.trophyId);
      const exists = await db.activity.findUnique({
        where: { userId_trophyKey: { userId: user.id, trophyKey: key } },
        select: { id: true },
      });
      if (exists) continue;
      const trophyExists = await db.trophy.findUnique({ where: { id: key }, select: { id: true } });
      if (!trophyExists) continue;
      await db.activity.create({
        data: {
          userId: user.id,
          trophyKey: key,
          earnedAt: new Date(tr.earnedDateTime),
          earnedRate: parseEarnedRate(tr.trophyEarnedRate),
        },
      });
      created++;
    }

    await db.userTitle.update({
      where: { userId_npCommunicationId: { userId: user.id, npCommunicationId: id } },
      data: { trophiesSyncedAt: new Date(title.lastUpdatedDateTime) },
    });
  }
  return created;
}
