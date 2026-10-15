import { Link } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { Avatar, ErrorBox, ProgressBar, Spinner, TrophyBadge } from "../components/ui";
import { platformsOf } from "../lib/stats";
import { useData } from "../lib/useData";
import type { Profile } from "../psn/types";

export function FriendsPage() {
  const { client } = useApp();
  const { data, error, loading, refresh } = useData((force) => client.friends(force), [client]);
  const friends = [...(data ?? [])].sort((a, b) => (b.level ?? -1) - (a.level ?? -1));

  return (
    <>
      <PageHeader title="Amigos" onRefresh={refresh} refreshing={loading} />
      <div className="space-y-3 px-4 pt-4">
        {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
        {loading && !data && <Spinner label="Carregando sua lista de amigos da PSN…" />}
        {data && friends.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">Sua lista de amigos da PSN está vazia.</p>
        )}
        {data && friends.length > 0 && <p className="text-xs text-muted">{friends.length} amigos na PSN</p>}
        {friends.map((f) => (
          <FriendCard key={f.accountId} friend={f} />
        ))}
      </div>
    </>
  );
}

function FriendCard({ friend: f }: { friend: Profile }) {
  const { client } = useApp();
  // Plataformas e jogos vêm da lista de troféus de cada amigo (carregada aos poucos).
  const { data: titles, loading } = useData(
    (force) => client.recentTitles(f.accountId, force).catch(() => null),
    [client, f.accountId],
  );
  const platforms = titles ? platformsOf(titles) : [];

  return (
    <Link to={`/u/${f.accountId}`} className="block rounded-2xl border border-line bg-surface p-4 active:border-muted">
      <div className="flex items-center gap-3">
        <Avatar src={f.avatarUrl} name={f.onlineId} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {f.onlineId} {f.isPlus && <span className="text-[11px] font-semibold text-gold">PS Plus</span>}
          </p>
          {f.level !== null ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs font-bold text-ps-blue-2">Nv. {f.level}</span>
              <div className="flex-1">
                <ProgressBar value={f.levelProgress ?? 0} />
              </div>
              <span className="text-[11px] text-muted">{f.levelProgress ?? 0}%</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">Troféus privados</p>
          )}
        </div>
      </div>

      {f.earned && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <TrophyBadge type="platinum" count={f.earned.platinum} />
          <TrophyBadge type="gold" count={f.earned.gold} />
          <TrophyBadge type="silver" count={f.earned.silver} />
          <TrophyBadge type="bronze" count={f.earned.bronze} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        {platforms.map((p) => (
          <span key={p} className="rounded-full border border-line px-2 py-0.5 text-muted">
            {p}
          </span>
        ))}
        {titles && (
          <span className="ml-auto text-muted">
            {titles.length >= 100 ? "100+" : titles.length} jogos
          </span>
        )}
        {loading && !titles && <span className="text-muted">carregando plataformas…</span>}
      </div>
    </Link>
  );
}
