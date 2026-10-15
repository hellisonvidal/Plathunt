import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { markNotificationsReadAction } from "../actions";
import { Avatar, timeAgo } from "@/components/ui";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { onlineId: true, avatarUrl: true } } },
  });

  const activityIds = [...new Set(notifications.map((n) => n.activityId))];
  const activities = await db.activity.findMany({
    where: { id: { in: activityIds } },
    include: { trophy: { include: { game: { select: { name: true, npCommunicationId: true } } } } },
  });
  const byId = new Map(activities.map((a) => [a.id, a]));
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notificações</h1>
        {hasUnread && (
          <form action={markNotificationsReadAction}>
            <button className="text-sm text-ps-blue-2 hover:underline">Marcar tudo como lido</button>
          </form>
        )}
      </div>

      <ul className="space-y-2">
        {notifications.map((n) => {
          const activity = byId.get(n.activityId);
          return (
            <li
              key={n.id}
              className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
                n.readAt ? "border-line bg-surface" : "border-ps-blue/50 bg-ps-blue/10"
              }`}
            >
              <Avatar src={n.actor.avatarUrl} name={n.actor.onlineId} size={32} />
              <div className="min-w-0 flex-1">
                <p>
                  <Link href={`/u/${n.actor.onlineId}`} className="font-semibold hover:underline">
                    {n.actor.onlineId}
                  </Link>{" "}
                  {n.kind === "reaction" ? (
                    <>reagiu com {n.emoji} ao seu troféu</>
                  ) : (
                    <>te deu os parabéns pelo troféu</>
                  )}{" "}
                  {activity && (
                    <>
                      <strong>{activity.trophy.name}</strong> em{" "}
                      <Link href={`/games/${activity.trophy.game.npCommunicationId}`} className="hover:underline">
                        {activity.trophy.game.name}
                      </Link>
                    </>
                  )}
                </p>
                {n.message && <p className="mt-1 rounded-lg bg-surface-2 px-3 py-2">“{n.message}”</p>}
                <p className="mt-1 text-xs text-muted">{timeAgo(n.createdAt.toISOString())}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {notifications.length === 0 && (
        <p className="py-10 text-center text-muted">Quando seus amigos reagirem às suas conquistas, você verá aqui.</p>
      )}
    </div>
  );
}
