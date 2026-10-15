import { useState } from "react";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { TitleList } from "../components/TitleList";
import { ErrorBox, Spinner, TrophyBadge } from "../components/ui";
import { useData } from "../lib/useData";

export function TrophiesPage() {
  const { client } = useApp();
  const { data, error, loading, refresh } = useData(
    async (force) => ({ me: await client.me(force), titles: await client.titles("me", force) }),
    [client],
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recentes" | "progresso">("recentes");

  const titles = (data?.titles ?? [])
    .filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) =>
      sort === "progresso"
        ? b.progress - a.progress
        : new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
    );
  const platinados = data?.titles.filter((t) => t.earned.platinum > 0).length ?? 0;

  return (
    <>
      <PageHeader title="Meus troféus" onRefresh={refresh} refreshing={loading} />
      <div className="space-y-4 px-4 pt-4">
        {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
        {loading && !data && <Spinner label="Importando sua lista de jogos…" />}

        {data && (
          <>
            <section className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm text-muted">
                Nível {data.me.level ?? "?"} · {data.titles.length} jogos · {platinados} platinados
              </p>
              {data.me.earned && (
                <div className="mt-2 flex gap-4">
                  <TrophyBadge type="platinum" count={data.me.earned.platinum} />
                  <TrophyBadge type="gold" count={data.me.earned.gold} />
                  <TrophyBadge type="silver" count={data.me.earned.silver} />
                  <TrophyBadge type="bronze" count={data.me.earned.bronze} />
                </div>
              )}
            </section>

            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar jogo"
                className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="rounded-full border border-line bg-surface-2 px-3 text-sm"
              >
                <option value="recentes">Recentes</option>
                <option value="progresso">Progresso</option>
              </select>
            </div>

            <TitleList titles={titles} accountId="me" />
          </>
        )}
      </div>
    </>
  );
}
