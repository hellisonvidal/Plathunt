import "server-only";
import { db } from "./db";
import { summarizeReactions } from "./social-constants";

export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await db.friendship.findMany({ where: { ownerId: userId }, select: { friendId: true } });
  return rows.map((r) => r.friendId);
}

/** O espectador pode interagir com a conquista se ela for dele ou de um amigo. */
export async function canInteract(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const f = await db.friendship.findUnique({
    where: { ownerId_friendId: { ownerId: viewerId, friendId: ownerId } },
  });
  return !!f;
}

const activityInclude = {
  user: { select: { id: true, onlineId: true, avatarUrl: true } },
  trophy: { include: { game: { select: { name: true, iconUrl: true, platform: true, npCommunicationId: true } } } },
  reactions: { select: { emoji: true, userId: true } },
  congrats: {
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { onlineId: true, avatarUrl: true } } },
  },
};

export interface FeedOptions {
  userIds: string[];
  viewerId: string;
  before?: Date;
  take?: number;
  types?: string[];
}

export async function getFeed({ userIds, viewerId, before, take = 25, types }: FeedOptions) {
  const rows = await db.activity.findMany({
    where: {
      userId: { in: userIds },
      ...(before ? { earnedAt: { lt: before } } : {}),
      ...(types ? { trophy: { type: { in: types } } } : {}),
    },
    orderBy: { earnedAt: "desc" },
    take: take + 1,
    include: activityInclude,
  });

  const hasMore = rows.length > take;
  const items = rows.slice(0, take).map((a) => ({
    id: a.id,
    earnedAt: a.earnedAt.toISOString(),
    earnedRate: a.earnedRate,
    user: a.user,
    isMine: a.userId === viewerId,
    trophy: {
      name: a.trophy.name,
      detail: a.trophy.detail,
      type: a.trophy.type,
      iconUrl: a.trophy.iconUrl,
    },
    game: a.trophy.game,
    reactions: summarizeReactions(a.reactions, viewerId),
    congrats: a.congrats.map((c) => ({
      id: c.id,
      message: c.message,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
    })),
  }));
  return { items, nextBefore: hasMore ? items[items.length - 1].earnedAt : null };
}

export type FeedItem = Awaited<ReturnType<typeof getFeed>>["items"][number];
