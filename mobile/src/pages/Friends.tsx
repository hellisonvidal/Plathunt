import { Link } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { Avatar, ErrorBox, Spinner, TrophyBadge } from "../components/ui";
import { useData } from "../lib/useData";

export function FriendsPage() {
  const { client } = useApp();
  const { data, error, loading, refresh } = useData(
    async (force) => ({ me: await client.me(force), friends: await client.friends(force) }),
    [client],
  );

  const ranking = data
    ? [{ ...data.me, isMe: true }, ...data.friends.map((f) => ({ ...f, isMe: false }))].sort(
        (a, b) => (b.earned?.platinum ?? -1) - (a.earned?.platinum ?? -1) || (b.level ?? 0) - (a.level ?? 0),
      )
    : [];

  return (
    <>
      <PageHeader title="Amigos" onRefresh={refresh} refreshing={loading} />
      <div className="space-y-4 px-4 pt-4">
        {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
        {loading && !data && <Spinner label="Carregando sua lista de amigos da PSN…" />}

        {data && data.friends.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">Sua lista de amigos da PSN está vazia.</p>
        )}

        {data && data.friends.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="mb-3 font-semibold">🏆 Ranking de platinas</h2>
            <ol className="space-y-3">
              {ranking.map((u, i) => (
                <li key={u.accountId}>
                  <Link to={`/u/${u.isMe ? "me" : u.accountId}`} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-right text-muted">{i + 1}</span>
                    <Avatar src={u.avatarUrl} name={u.onlineId} size={36} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {u.onlineId}
                      {u.isMe && <span className="text-muted"> (você)</span>}
                    </span>
                    {u.earned ? (
                      <>
                        <TrophyBadge type="platinum" count={u.earned.platinum} />
                        <span className="w-14 text-right text-muted">Nv. {u.level}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">troféus privados</span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </>
  );
}
