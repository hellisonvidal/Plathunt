import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getFriendIds } from "@/lib/social";
import { Avatar, ProgressBar, TrophyBadge, rarityLabel } from "@/components/ui";

const TYPE_ORDER: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const game = await db.game.findUnique({
    where: { npCommunicationId: decodeURIComponent(id) },
    include: { trophies: true },
  });
  if (!game) notFound();

  const friendIds = await getFriendIds(user.id);
  const [mine, players, myActivities] = await Promise.all([
    db.userTitle.findUnique({
      where: { userId_npCommunicationId: { userId: user.id, npCommunicationId: game.npCommunicationId } },
    }),
    db.userTitle.findMany({
      where: { npCommunicationId: game.npCommunicationId, userId: { in: friendIds } },
      include: { user: { select: { onlineId: true, avatarUrl: true } } },
      orderBy: { progress: "desc" },
    }),
    db.activity.findMany({
      where: { userId: user.id, trophy: { npCommunicationId: game.npCommunicationId } },
      select: { trophyKey: true, earnedAt: true, earnedRate: true },
    }),
  ]);
  const earned = new Map(myActivities.map((a) => [a.trophyKey, a]));
  const trophies = [...game.trophies].sort(
    (a, b) => Number(earned.has(b.id)) - Number(earned.has(a.id)) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );

  return (
    <div className="space-y-6">
      <header className="flex gap-4">
        {game.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.iconUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{game.name}</h1>
          <p className="text-sm text-muted">{game.platform}</p>
          {mine && (
            <div className="mt-3 flex items-center gap-2">
              <ProgressBar value={mine.progress} />
              <span className="text-sm text-muted">{mine.progress}%</span>
            </div>
          )}
        </div>
      </header>

      {players.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Amigos jogando</h2>
          <ul className="flex flex-wrap gap-3">
            {players.map((p) => (
              <li key={p.userId}>
                <Link href={`/u/${p.user.onlineId}`} className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-sm">
                  <Avatar src={p.user.avatarUrl} name={p.user.onlineId} size={28} />
                  {p.user.onlineId} · {p.progress}%{p.earnedPlatinum > 0 && " 🏆"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Troféus</h2>
        {trophies.length === 0 && (
          <p className="text-sm text-muted">A lista de troféus deste jogo será importada na próxima sincronização.</p>
        )}
        <ul className="space-y-2">
          {trophies.map((t) => {
            const got = earned.get(t.id);
            const hiddenLocked = t.hidden && !got;
            return (
              <li
                key={t.id}
                className={`flex gap-3 rounded-xl border border-line bg-surface p-3 ${got ? "" : "opacity-60"}`}
              >
                {t.iconUrl && !hiddenLocked ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.iconUrl} alt="" className={`h-12 w-12 shrink-0 rounded-lg ${got ? "" : "grayscale"}`} />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2">?</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{hiddenLocked ? "Troféu secreto" : t.name}</span>
                    <TrophyBadge type={t.type} />
                  </div>
                  {!hiddenLocked && t.detail && <p className="text-sm text-muted">{t.detail}</p>}
                  {got && (
                    <p className="mt-1 text-xs text-ps-blue-2">
                      Conquistado em {got.earnedAt.toLocaleDateString("pt-BR")}
                      {rarityLabel(got.earnedRate) && ` · ${rarityLabel(got.earnedRate)}`}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
