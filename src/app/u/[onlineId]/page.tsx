import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canInteract, getFeed } from "@/lib/social";
import { ActivityCard } from "@/components/ActivityCard";
import { Avatar, TrophyBadge } from "@/components/ui";

export default async function ProfilePage({ params }: { params: Promise<{ onlineId: string }> }) {
  const viewer = await requireUser();
  const { onlineId } = await params;
  const profile = await db.user.findUnique({ where: { onlineId: decodeURIComponent(onlineId) } });
  if (!profile) notFound();

  const allowed = await canInteract(viewer.id, profile.id);
  const [feed, gameCount] = await Promise.all([
    allowed ? getFeed({ userIds: [profile.id], viewerId: viewer.id, take: 20 }) : null,
    db.userTitle.count({ where: { userId: profile.id } }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Avatar src={profile.avatarUrl} name={profile.onlineId} size={72} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {profile.onlineId} {profile.isPlus && <span className="text-sm text-gold">PS Plus</span>}
          </h1>
          {profile.aboutMe && <p className="text-sm text-muted">{profile.aboutMe}</p>}
          <p className="mt-1 text-sm text-muted">
            Nível {profile.trophyLevel} · {gameCount} jogos
          </p>
          <div className="mt-2 flex gap-3">
            <TrophyBadge type="platinum" count={profile.platinum} />
            <TrophyBadge type="gold" count={profile.gold} />
            <TrophyBadge type="silver" count={profile.silver} />
            <TrophyBadge type="bronze" count={profile.bronze} />
          </div>
        </div>
      </header>

      {!feed ? (
        <p className="text-center text-sm text-muted">
          Vocês não são amigos na PSN. Adicione {profile.onlineId} na PSN e sincronize para ver as conquistas.
        </p>
      ) : (
        <div className="space-y-4">
          <h2 className="font-semibold">Conquistas recentes</h2>
          {feed.items.map((item) => (
            <ActivityCard key={item.id} item={item} viewerOnlineId={viewer.onlineId} />
          ))}
          {feed.items.length === 0 && <p className="text-sm text-muted">Nada por aqui ainda.</p>}
        </div>
      )}
    </div>
  );
}
