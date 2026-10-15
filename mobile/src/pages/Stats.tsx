import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { GroupedBars, Legend, StatTile, type Series } from "../components/charts";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, Spinner, TrophyBadge } from "../components/ui";
import { computeStats, filterByPlatform, formatDuration, matchPlaytime, platformsOf, withEarnedTrophies } from "../lib/stats";
import { useData } from "../lib/useData";
import type { Title } from "../psn/types";

const TYPES = ["platinum", "gold", "silver", "bronze"] as const;

export function StatsPage() {
  const { client } = useApp();
  const [platform, setPlatform] = useState<string | null>(null);
  const [friendId, setFriendId] = useState<string>("");

  const mine = useData(
    async (force) => {
      const [me, titles, played, friends] = await Promise.all([
        client.me(force),
        client.titles("me", force),
        client.playedGames("me", force),
        client.friends(force),
      ]);
      return { me, titles, playtime: matchPlaytime(titles, played ?? []), friends };
    },
    [client],
  );

  const theirs = useData(
    async (force) => {
      if (!friendId) return null;
      const [titles, played] = await Promise.all([
        client.titles(friendId, force).catch(() => null),
        client.playedGames(friendId, force),
      ]);
      return titles ? { titles, playtime: matchPlaytime(titles, played ?? []), hasPlaytime: !!played } : { titles: null };
    },
    [client, friendId],
  );

  const data = mine.data;
  const friend = data?.friends.find((f) => f.accountId === friendId) ?? null;
  const friendTitles = theirs.data?.titles ?? null;

  // Plataformas com troféus (suas e, se estiver comparando, do amigo).
  // Jogos sem nenhum troféu conquistado ficam de fora das estatísticas.
  const platforms = data ? platformsOf(withEarnedTrophies([...data.titles, ...(friendTitles ?? [])])) : [];

  const stats = (titles: Title[], playtime: Map<string, number>) =>
    computeStats(filterByPlatform(withEarnedTrophies(titles), platform), playtime);
  const meStats = data ? stats(data.titles, data.playtime) : null;
  const frStats =
    friend && friendTitles && theirs.data && "playtime" in theirs.data && theirs.data.playtime
      ? stats(friendTitles, theirs.data.playtime)
      : null;

  const all = [meStats, frStats].filter((s): s is NonNullable<typeof s> => s !== null);
  const names = [data?.me.onlineId ?? "Você", friend?.onlineId ?? ""].slice(0, all.length);
  const series = (pick: (s: NonNullable<typeof meStats>) => number[]): Series[] =>
    all.map((s, i) => ({ name: names[i], values: pick(s) }));
  const platformRows = [...new Set(all.flatMap((s) => s.byPlatform.map((p) => p.platform)))];

  return (
    <>
      <PageHeader title="Estatísticas" onRefresh={() => (mine.refresh(), theirs.refresh())} refreshing={mine.loading} />
      <div className="space-y-4 px-4 pt-4">
        {mine.error ? <ErrorBox error={mine.error} onRetry={mine.refresh} /> : null}
        {mine.loading && !data && <Spinner label="Calculando suas estatísticas…" />}

        {data && meStats && (
          <>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 text-sm" role="tablist" aria-label="Plataforma">
              {[null, ...platforms].map((p) => (
                <button
                  key={p ?? "todas"}
                  role="tab"
                  aria-selected={platform === p}
                  onClick={() => setPlatform(p)}
                  className={`shrink-0 rounded-full px-3 py-1.5 ${
                    platform === p ? "bg-ps-blue font-semibold" : "border border-line text-muted"
                  }`}
                >
                  {p ?? "Todas"}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm">
              <span className="text-muted">Comparar com</span>
              <select
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
              >
                <option value="">ninguém</option>
                {data.friends.map((f) => (
                  <option key={f.accountId} value={f.accountId}>
                    {f.onlineId}
                  </option>
                ))}
              </select>
            </label>

            {friend && theirs.loading && <Spinner label={`Buscando os jogos de ${friend.onlineId}…`} />}
            {friend && !theirs.loading && !frStats && (
              <p className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
                Os troféus de {friend.onlineId} são privados, então não dá para comparar.
              </p>
            )}

            <Legend series={series(() => [])} />

            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Jogos" names={names} values={all.map((s) => s.games.toLocaleString("pt-BR"))} />
              <StatTile label="Platinas" names={names} values={all.map((s) => s.platinums.toLocaleString("pt-BR"))} />
              <StatTile label="Jogos 100%" names={names} values={all.map((s) => s.completed.toLocaleString("pt-BR"))} />
              <StatTile label="Conclusão média" names={names} values={all.map((s) => `${s.avgProgress}%`)} />
              <StatTile label="Troféus" names={names} values={all.map((s) => s.totalTrophies.toLocaleString("pt-BR"))} />
              <StatTile label="Tempo de jogo" names={names} values={all.map((s) => formatDuration(s.playSeconds))} />
            </div>

            <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <h2 className="font-semibold">Troféus por tipo</h2>
              <GroupedBars
                categories={TYPES.map((t) => (
                  <TrophyBadge key={t} type={t} />
                ))}
                series={series((s) => TYPES.map((t) => s.trophies[t]))}
              />
            </section>

            {platform === null && platformRows.length > 1 && (
              <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
                <h2 className="font-semibold">Jogos por plataforma</h2>
                <GroupedBars
                  categories={platformRows}
                  series={series((s) => platformRows.map((p) => s.byPlatform.find((b) => b.platform === p)?.games ?? 0))}
                />
              </section>
            )}

            {all.map((s, i) =>
              s.topPlayed.length ? (
                <section key={names[i]} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
                  <h2 className="font-semibold">Mais jogados{all.length > 1 && ` · ${names[i]}`}</h2>
                  <GroupedBars
                    categories={s.topPlayed.map((t) => (
                      <Link
                        key={t.title.id}
                        to={`/game/${i === 0 ? "me" : friendId}/${t.title.id}?service=${t.title.service}`}
                        className="line-clamp-2 text-xs"
                      >
                        {t.title.name}
                      </Link>
                    ))}
                    series={[{ name: names[i], values: s.topPlayed.map((t) => t.seconds) }]}
                    format={formatDuration}
                    colorOffset={i}
                  />
                  <p className="text-[11px] text-muted">
                    Tempo disponível para {s.gamesWithPlaytime} de {s.games} jogos (PS3 e Vita não registram).
                  </p>
                </section>
              ) : null,
            )}
          </>
        )}
      </div>
    </>
  );
}
