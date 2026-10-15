import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { SyncButton } from "@/components/SyncButton";
import { Avatar, TrophyBadge } from "@/components/ui";

export default async function FriendsPage() {
  const user = await requireUser();
  const friendships = await db.friendship.findMany({
    where: { ownerId: user.id },
    include: { friend: true },
  });
  const friends = friendships.map((f) => f.friend).sort((a, b) => b.trophyLevel - a.trophyLevel);
  const ranking = [user, ...friends].sort((a, b) => b.platinum - a.platinum || b.trophyLevel - a.trophyLevel);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Amigos</h1>
          <p className="text-sm text-muted">
            Seus amigos da PSN que também usam o Perseus aparecem aqui automaticamente.
          </p>
        </div>
        <SyncButton />
      </div>

      {friends.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-semibold">🏆 Ranking de platinas</h2>
          <ol className="space-y-2">
            {ranking.map((u, i) => (
              <li key={u.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-right text-muted">{i + 1}</span>
                <Avatar src={u.avatarUrl} name={u.onlineId} size={28} />
                <Link href={`/u/${u.onlineId}`} className="flex-1 font-medium hover:underline">
                  {u.id === user.id ? `${u.onlineId} (você)` : u.onlineId}
                </Link>
                <TrophyBadge type="platinum" count={u.platinum} />
                <span className="w-16 text-right text-muted">Nv. {u.trophyLevel}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {friends.length === 0 && (
        <section className="rounded-2xl border border-dashed border-line p-5 text-sm">
          <p className="font-semibold">Ninguém da sua lista de amigos da PSN está aqui ainda.</p>
          <p className="mt-2 text-muted">
            Mande o link do Perseus para eles. Assim que entrarem com a conta PSN, vocês aparecem um no feed do outro,
            sem precisar adicionar nada.
          </p>
        </section>
      )}
    </div>
  );
}
