import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { Avatar, ErrorBox, Spinner } from "../components/ui";
import { useData } from "../lib/useData";
import type { Profile } from "../psn/types";

const METRICS = {
  platinas: { label: "Platinas", value: (p: Profile) => p.earned?.platinum ?? null },
  nivel: { label: "Nível", value: (p: Profile) => p.level },
  trofeus: {
    label: "Troféus",
    value: (p: Profile) => (p.earned ? p.earned.platinum + p.earned.gold + p.earned.silver + p.earned.bronze : null),
  },
} as const;
type Metric = keyof typeof METRICS;
const MEDALS = ["🥇", "🥈", "🥉"];

export function RankingPage() {
  const { client } = useApp();
  const [metric, setMetric] = useState<Metric>("platinas");
  const { data, error, loading, refresh } = useData(
    async (force) => ({ me: await client.me(force), friends: await client.friends(force) }),
    [client],
  );

  const value = METRICS[metric].value;
  const rows = data
    ? [{ ...data.me, isMe: true }, ...data.friends.map((f) => ({ ...f, isMe: false }))]
        .map((p) => ({ ...p, score: value(p) }))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    : [];
  const leader = Math.max(1, ...rows.map((r) => r.score ?? 0));
  const myPosition = rows.findIndex((r) => r.isMe) + 1;

  return (
    <>
      <PageHeader title="Ranking de platinas" onRefresh={refresh} refreshing={loading} />
      <div className="space-y-4 px-4 pt-4">
        {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
        {loading && !data && <Spinner label="Montando o ranking com seus amigos…" />}

        {data && (
          <>
            <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-surface p-1 text-sm">
              {(Object.keys(METRICS) as Metric[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={metric === m}
                  onClick={() => setMetric(m)}
                  className={`rounded-full py-1.5 ${metric === m ? "bg-ps-blue font-semibold" : "text-muted"}`}
                >
                  {METRICS[m].label}
                </button>
              ))}
            </div>

            {myPosition > 0 && (
              <p className="text-center text-sm text-muted">
                Você está em <strong className="text-ink">{myPosition}º</strong> de {rows.length}
              </p>
            )}

            <ol className="space-y-2">
              {rows.map((r, i) => (
                <li key={r.accountId}>
                  <Link
                    to={r.isMe ? "/" : `/u/${r.accountId}`}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      r.isMe ? "border-ps-blue-2 bg-ps-blue/10" : "border-line bg-surface"
                    }`}
                  >
                    <span className="w-7 text-center text-lg">{MEDALS[i] ?? <span className="text-sm text-muted">{i + 1}</span>}</span>
                    <Avatar src={r.avatarUrl} name={r.onlineId} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {r.onlineId}
                        {r.isMe && <span className="font-normal text-muted"> (você)</span>}
                      </p>
                      {r.score !== null ? (
                        <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-ps-blue-2"
                            style={{ width: `${(r.score / leader) * 100}%` }}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-muted">troféus privados</p>
                      )}
                    </div>
                    <span className="w-14 text-right font-bold tabular-nums">
                      {r.score?.toLocaleString("pt-BR") ?? "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </>
  );
}
