import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { GroupedBars, Legend, SERIES_COLORS, StatTile, type Series } from "../components/charts";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, Spinner, TrophyBadge } from "../components/ui";
import {
  computeStats,
  filterByPlatform,
  formatDuration,
  matchPlayed,
  platformsOf,
  titlesByPlatform,
  withEarnedTrophies,
  type PlayedOn,
  type PlayInfo,
  PLATFORM_ORDER,
} from "../lib/stats";
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
      return { me, titles, ...playMaps(matchPlayed(titles, played ?? [])), friends };
    },
    [client],
  );

  const theirs = useData(
    async (force) => {
      if (!friendId) return null;
      const [titles, played] = await Promise.all([
        // Troféus privados: a PSN recusa a lista de jogos.
        client.titles(friendId, force).catch(() => null),
        client.playedGames(friendId, force),
      ]);
      return {
        friendId,
        titles,
        ...playMaps(titles ? matchPlayed(titles, played ?? []) : new Map()),
      };
    },
    [client, friendId],
  );

  const data = mine.data;
  const friend = data?.friends.find((f) => f.accountId === friendId) ?? null;
  // Ao trocar de amigo, os dados do anterior ficam em `theirs.data` até os
  // novos chegarem: só valem os do amigo escolhido agora.
  const friendData = friend && theirs.data?.friendId === friend.accountId ? theirs.data : null;
  const friendTitles = friendData?.titles ?? null;
  const friendLoading = !!friend && !friendData && !theirs.error;

  // Plataformas com troféus (suas e, se estiver comparando, do amigo).
  // Jogos sem nenhum troféu conquistado ficam de fora das estatísticas.
  // Cada jogo conta em uma só plataforma (a jogada ou a principal da lista).
  const friendPlay = friendTitles ? friendData : null;
  const platforms = data
    ? [
        ...new Set([
          ...platformsOf(withEarnedTrophies(data.titles), data.playedOn),
          ...(friendTitles ? platformsOf(withEarnedTrophies(friendTitles), friendPlay?.playedOn) : []),
        ]),
      ].sort((a, b) => PLATFORM_RANK(a) - PLATFORM_RANK(b))
    : [];

  const stats = (titles: Title[], playtime: Map<string, number>, playedOn: PlayedOn) =>
    computeStats(filterByPlatform(withEarnedTrophies(titles), platform, playedOn), playtime, playedOn);
  const meStats = data ? stats(data.titles, data.playtime, data.playedOn) : null;
  const frStats =
    friend && friendTitles && friendPlay ? stats(friendTitles, friendPlay.playtime, friendPlay.playedOn) : null;

  const all = [meStats, frStats].filter((s): s is NonNullable<typeof s> => s !== null);
  const names = [data?.me.onlineId ?? "Você", friend?.onlineId ?? ""].slice(0, all.length);
  const series = (pick: (s: NonNullable<typeof meStats>) => number[]): Series[] =>
    all.map((s, i) => ({ name: names[i], values: pick(s) }));

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
                {[...data.friends]
                  .sort((a, b) => a.onlineId.localeCompare(b.onlineId, "pt-BR", { sensitivity: "base" }))
                  .map((f) => (
                    <option key={f.accountId} value={f.accountId}>
                      {f.onlineId}
                    </option>
                  ))}
              </select>
            </label>

            {friend && (friendLoading || theirs.loading) && (
              <Spinner label={`Buscando os jogos de ${friend.onlineId}…`} />
            )}
            {friend && theirs.error ? <ErrorBox error={theirs.error} onRetry={theirs.refresh} /> : null}
            {friend && friendData && !friendTitles && (
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
              <StatTile
                label="Troféus"
                names={names}
                values={all.map((s) => s.totalTrophies.toLocaleString("pt-BR"))}
              />
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

            <PlatformTitles
              players={[
                { name: names[0], accountId: "me", titles: data.titles, playedOn: data.playedOn },
                ...(friend && friendTitles && friendPlay
                  ? [
                      {
                        name: friend.onlineId,
                        accountId: friend.accountId,
                        titles: friendTitles,
                        playedOn: friendPlay.playedOn,
                      },
                    ]
                  : []),
              ]}
              platform={platform}
            />

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
                  <p className="text-[0.6875rem] text-muted">
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

/** Separa o resultado de `matchPlayed` em tempo por jogo e plataforma jogada por jogo. */
function playMaps(play: Map<string, PlayInfo>): { playtime: Map<string, number>; playedOn: PlayedOn } {
  return {
    playtime: new Map([...play].map(([id, p]) => [id, p.seconds])),
    playedOn: new Map([...play].map(([id, p]) => [id, p.platform])),
  };
}

const PLATFORM_RANK = (p: string) => PLATFORM_ORDER.indexOf(p) + 1 || 99;

interface PlatformPlayer {
  name: string;
  accountId: string;
  titles: Title[];
  playedOn: PlayedOn;
}

/**
 * Títulos jogados em cada plataforma (só jogos com troféus), para você e o
 * amigo comparado. Cada plataforma abre e fecha ao tocar.
 */
function PlatformTitles({ players, platform }: { players: PlatformPlayer[]; platform: string | null }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const grouped = players.map((p) => titlesByPlatform(withEarnedTrophies(p.titles), p.playedOn));
  const platforms = [...new Set(grouped.flatMap((g) => [...g.keys()]))]
    .filter((p) => !platform || p === platform)
    .sort((a, b) => PLATFORM_RANK(a) - PLATFORM_RANK(b));
  if (!platforms.length) return null;

  const toggle = (p: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <h2 className="px-4 pb-2 pt-4 font-semibold">Títulos por plataforma</h2>
      {platforms.map((p) => {
        const expanded = platform !== null || open.has(p);
        return (
          <div key={p} className="border-t border-line">
            <button
              onClick={() => toggle(p)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
            >
              <span className="flex-1 font-semibold">{p}</span>
              {grouped.map((g, i) => (
                <span key={players[i].accountId} className="flex items-center gap-1 text-xs text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                  {g.get(p)?.length ?? 0}
                </span>
              ))}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
                className={`h-4 w-4 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {expanded && (
              <div className="space-y-3 px-4 pb-4">
                {grouped.map((g, i) => {
                  const list = g.get(p) ?? [];
                  return (
                    <div key={players[i].accountId}>
                      {players.length > 1 && (
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                          {players[i].name} · {list.length} {list.length === 1 ? "jogo" : "jogos"}
                        </p>
                      )}
                      {list.length === 0 ? (
                        <p className="text-xs text-muted">Nenhum jogo com troféus nesta plataforma.</p>
                      ) : (
                        <ul className="divide-y divide-line">
                          {list.map((t) => (
                            <li key={t.id}>
                              <Link
                                to={`/game/${players[i].accountId}/${t.id}?service=${t.service}`}
                                className="flex items-center gap-2 py-2 text-sm"
                              >
                                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                                {t.earned.platinum > 0 && <TrophyBadge type="platinum" count={t.earned.platinum} />}
                                <span className="w-10 text-right text-xs tabular-nums text-muted">{t.progress}%</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
