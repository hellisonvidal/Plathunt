import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { SyncButton } from "@/components/SyncButton";
import { ProgressBar, TrophyBadge } from "@/components/ui";

const SORTS = {
  recentes: { label: "Recentes", orderBy: { lastUpdatedAt: "desc" as const } },
  progresso: { label: "Progresso", orderBy: { progress: "desc" as const } },
} as const;

export default async function TrophiesPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const user = await requireUser();
  const { sort } = await searchParams;
  const sortKey = sort === "progresso" ? "progresso" : "recentes";

  const titles = await db.userTitle.findMany({
    where: { userId: user.id },
    orderBy: SORTS[sortKey].orderBy,
    include: { game: true },
  });
  const platinados = titles.filter((t) => t.earnedPlatinum > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meus troféus</h1>
          <p className="text-sm text-muted">
            {titles.length} jogos · {platinados} platinados
          </p>
        </div>
        <SyncButton />
      </div>

      <nav className="flex gap-2 text-sm">
        {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
          <Link
            key={k}
            href={`/trophies?sort=${k}`}
            className={`rounded-full px-3 py-1.5 ${sortKey === k ? "bg-ps-blue font-semibold" : "border border-line"}`}
          >
            {SORTS[k].label}
          </Link>
        ))}
      </nav>

      <ul className="space-y-3">
        {titles.map((t) => (
          <li key={t.npCommunicationId}>
            <Link
              href={`/games/${t.npCommunicationId}`}
              className="flex gap-4 rounded-2xl border border-line bg-surface p-3 hover:border-muted"
            >
              {t.game.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.game.iconUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-semibold">{t.game.name}</h2>
                  <span className="shrink-0 text-xs text-muted">{t.game.platform}</span>
                </div>
                <div className="mt-1 flex gap-3">
                  {t.game.definedPlatinum > 0 && <TrophyBadge type="platinum" count={t.earnedPlatinum} />}
                  <TrophyBadge type="gold" count={t.earnedGold} />
                  <TrophyBadge type="silver" count={t.earnedSilver} />
                  <TrophyBadge type="bronze" count={t.earnedBronze} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={t.progress} />
                  <span className="w-10 text-right text-xs text-muted">{t.progress}%</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {titles.length === 0 && (
        <p className="py-10 text-center text-muted">Nenhum jogo importado ainda. Clique em sincronizar.</p>
      )}
    </div>
  );
}
