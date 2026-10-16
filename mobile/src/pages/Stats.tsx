import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { GroupedBars, Legend, SERIES_COLORS, StatTile, type Series } from "../components/charts";
import { Mural, MURAL_LABELS, type MuralCategory } from "../components/Mural";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, Spinner, TrophyBadge } from "../components/ui";
import {
  compareTitles,
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
  // Categoria tocada nos quadros: abre o mural de jogos logo abaixo.
  const [mural, setMural] = useState<MuralCategory>("platinas");

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
            <PlatformPicker
              platforms={platforms}
              selected={platform}
              onSelect={setPlatform}
              counts={[
                { name: names[0] ?? "Você", titles: data.titles, playedOn: data.playedOn },
                ...(friend && friendTitles && friendPlay
                  ? [{ name: friend.onlineId, titles: friendTitles, playedOn: friendPlay.playedOn }]
                  : []),
              ]}
            />

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
              {(
                [
                  ["jogos", all.map((s) => s.games.toLocaleString("pt-BR"))],
                  ["platinas", all.map((s) => s.platinums.toLocaleString("pt-BR"))],
                  ["completos", all.map((s) => s.completed.toLocaleString("pt-BR"))],
                  ["conclusao", all.map((s) => `${s.avgProgress}%`)],
                  ["trofeus", all.map((s) => s.totalTrophies.toLocaleString("pt-BR"))],
                  ["tempo", all.map((s) => formatDuration(s.playSeconds))],
                ] as [MuralCategory, string[]][]
              ).map(([key, values]) => (
                <StatTile
                  key={key}
                  label={MURAL_LABELS[key]}
                  names={names}
                  values={values}
                  selected={mural === key}
                  onSelect={() => setMural(key)}
                />
              ))}
            </div>

            <Mural
              key={`${mural}:${friendId}`}
              category={mural}
              platform={platform}
              players={[
                { name: names[0], accountId: "me", titles: data.titles, playtime: data.playtime, playedOn: data.playedOn },
                ...(friend && friendTitles && friendPlay
                  ? [
                      {
                        name: friend.onlineId,
                        accountId: friend.accountId,
                        titles: friendTitles,
                        playtime: friendPlay.playtime,
                        playedOn: friendPlay.playedOn,
                      },
                    ]
                  : []),
              ]}
            />

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

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden
    className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/**
 * Filtro de plataforma: um botão mostra a escolhida e, ao tocar, expande as
 * plataformas jogadas com quantos jogos cada jogador tem em cada uma.
 */
function PlatformPicker({
  platforms,
  selected,
  onSelect,
  counts,
}: {
  platforms: string[];
  selected: string | null;
  onSelect: (p: string | null) => void;
  counts: { name: string; titles: Title[]; playedOn: PlayedOn }[];
}) {
  const [open, setOpen] = useState(false);
  const perPlayer = counts.map((c) => titlesByPlatform(withEarnedTrophies(c.titles), c.playedOn));
  const totalOf = (p: string | null) =>
    perPlayer.map((g) => (p ? (g.get(p)?.length ?? 0) : [...g.values()].reduce((a, l) => a + l.length, 0)));
  const pick = (p: string | null) => {
    onSelect(p);
    setOpen(false);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left active:bg-surface-2"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ps-blue text-lg" aria-hidden>
          🎮
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">
            Plataformas jogadas · {platforms.length}
          </span>
          <span className="block font-semibold">{selected ?? "Todas as plataformas"}</span>
        </span>
        <span className="text-xs text-muted">{open ? "Fechar" : "Expandir"}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 border-t border-line p-3" role="radiogroup" aria-label="Plataforma">
          {[null, ...platforms].map((p) => (
            <button
              key={p ?? "todas"}
              role="radio"
              aria-checked={selected === p}
              onClick={() => pick(p)}
              className={`rounded-xl border-2 p-3 text-left ${selected === p ? "border-ps-blue-2 bg-surface-2" : "border-line"}`}
            >
              <span className="block font-semibold">{p ?? "Todas"}</span>
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {totalOf(p).map((n, i) => (
                  <span key={counts[i].name} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                    {n} {n === 1 ? "jogo" : "jogos"}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

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
      <h2 className="px-4 pb-2 pt-4 font-semibold">
        {players.length > 1 ? `Comparação por plataforma · ${players[1].name}` : "Títulos por plataforma"}
      </h2>
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
              <Chevron open={expanded} />
            </button>
            {expanded &&
              (players.length > 1 ? (
                <PlatformComparison
                  mine={grouped[0].get(p) ?? []}
                  theirs={grouped[1].get(p) ?? []}
                  players={players}
                />
              ) : (
                <div className="px-4 pb-4">
                  <TitleLinks list={grouped[0].get(p) ?? []} accountId={players[0].accountId} />
                </div>
              ))}
          </div>
        );
      })}
    </section>
  );
}

function TitleLinks({ list, accountId }: { list: Title[]; accountId: string }) {
  if (!list.length) return <p className="text-xs text-muted">Nenhum jogo com troféus nesta plataforma.</p>;
  return (
    <ul className="divide-y divide-line">
      {list.map((t) => (
        <li key={t.id}>
          <Link to={`/game/${accountId}/${t.id}?service=${t.service}`} className="flex items-center gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            {t.earned.platinum > 0 && <TrophyBadge type="platinum" count={t.earned.platinum} />}
            <span className="w-10 text-right text-xs tabular-nums text-muted">{t.progress}%</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Barra fininha de progresso na cor do jogador. */
function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </span>
  );
}

/**
 * Comparação dos títulos de uma plataforma entre você e o amigo: jogos em
 * comum lado a lado (progresso e platina de cada um) e os que só um jogou.
 */
function PlatformComparison({
  mine,
  theirs,
  players,
}: {
  mine: Title[];
  theirs: Title[];
  players: PlatformPlayer[];
}) {
  const { common, onlyMine, onlyTheirs } = compareTitles(mine, theirs);
  const [me, friend] = players;
  const ahead = common.filter((c) => c.mine.progress > c.theirs.progress).length;
  const behind = common.filter((c) => c.mine.progress < c.theirs.progress).length;

  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-2">
          <p className="text-lg font-bold">{common.length}</p>
          <p className="text-[0.6875rem] text-muted">em comum</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <p className="text-lg font-bold" style={{ color: SERIES_COLORS[0] }}>
            {ahead}
          </p>
          <p className="text-[0.6875rem] text-muted">você na frente</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <p className="text-lg font-bold" style={{ color: SERIES_COLORS[1] }}>
            {behind}
          </p>
          <p className="truncate text-[0.6875rem] text-muted">{friend.name} na frente</p>
        </div>
      </div>

      {common.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Jogos em comum</p>
          <ul className="divide-y divide-line">
            {common.map(({ mine: a, theirs: b }) => (
              <li key={a.id} className="py-2.5">
                <Link to={`/game/me/${a.id}?service=${a.service}`} className="block truncate text-sm font-semibold">
                  {a.name}
                </Link>
                {[
                  { player: me, t: a, color: SERIES_COLORS[0] },
                  { player: friend, t: b, color: SERIES_COLORS[1] },
                ].map(({ player, t, color }) => (
                  <Link
                    key={player.accountId}
                    to={`/game/${player.accountId}/${t.id}?service=${t.service}`}
                    className="mt-1 flex items-center gap-2 text-xs"
                  >
                    <span className="w-20 shrink-0 truncate text-muted">{player.name}</span>
                    <span className="flex-1">
                      <MiniBar value={t.progress} color={color} />
                    </span>
                    {t.earned.platinum > 0 ? (
                      <TrophyBadge type="platinum" />
                    ) : (
                      <span className="w-4" aria-hidden />
                    )}
                    <span className="w-9 text-right tabular-nums">{t.progress}%</span>
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {[
        { title: `Só ${me.name}`, list: onlyMine, player: me, color: SERIES_COLORS[0] },
        { title: `Só ${friend.name}`, list: onlyTheirs, player: friend, color: SERIES_COLORS[1] },
      ].map(({ title, list, player, color }) =>
        list.length ? (
          <div key={player.accountId}>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              {title} · {list.length}
            </p>
            <TitleLinks list={list} accountId={player.accountId} />
          </div>
        ) : null,
      )}
    </div>
  );
}
