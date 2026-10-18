import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../app";
import { GroupedBars, Legend, SERIES_COLORS, StatTile, type Series } from "../components/charts";
import { CompletionTimes } from "../components/CompletionTimes";
import { ConsoleArt } from "../components/Consoles";
import { Mural, MURAL_LABELS, type MuralCategory, type MuralKind } from "../components/Mural";
import { PageHeader } from "../components/PageHeader";
import { RankingView, useRanking } from "./Ranking";
import { locale, t } from "../i18n";
import { ErrorBox, GameIcon, Spinner, TrophyBadge } from "../components/ui";
import {
  compareTitles,
  computeStats,
  filterByPlatform,
  formatDuration,
  gamesByYear,
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
  // O Ranking fica dentro de Estatísticas (/stats?view=ranking).
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "ranking" ? "ranking" : "stats";
  const setView = (v: "stats" | "ranking") => setParams(v === "ranking" ? { view: "ranking" } : {}, { replace: true });
  const ranking = useRanking();
  const [platform, setPlatform] = useState<string | null>(null);
  const [friendId, setFriendId] = useState<string>("");
  // Categoria tocada nos quadros: abre o mural de jogos em um pop-up.
  const [mural, setMural] = useState<MuralKind | null>(null);

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
  const names = [data?.me.onlineId ?? t("Você"), friend?.onlineId ?? ""].slice(0, all.length);
  const series = (pick: (s: NonNullable<typeof meStats>) => number[]): Series[] =>
    all.map((s, i) => ({ name: names[i], values: pick(s) }));

  return (
    <>
      <PageHeader
        title={view === "ranking" ? t("Ranking") : t("Estatísticas")}
        onRefresh={view === "ranking" ? ranking.refresh : () => (mine.refresh(), theirs.refresh())}
        refreshing={view === "ranking" ? ranking.loading : mine.loading}
      />
      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1 text-sm" role="tablist">
          {(
            [
              ["stats", "📊 Estatísticas"],
              ["ranking", "🏆 Ranking"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`rounded-xl py-2 font-semibold ${view === key ? "bg-ps-blue" : "text-muted"}`}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {view === "ranking" ? (
          <RankingView ranking={ranking} />
        ) : (
          <>
            {mine.error ? <ErrorBox error={mine.error} onRetry={mine.refresh} /> : null}
            {mine.loading && !data && <Spinner label={t("Calculando suas estatísticas…")} />}

            {data && meStats && (
              <>
                <PlatformPicker
                  platforms={platforms}
                  selected={platform}
                  onSelect={setPlatform}
                  counts={[
                    { name: names[0] ?? t("Você"), titles: data.titles, playedOn: data.playedOn },
                    ...(friend && friendTitles && friendPlay
                      ? [{ name: friend.onlineId, titles: friendTitles, playedOn: friendPlay.playedOn }]
                      : []),
                  ]}
                />

                <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm">
                  <span className="text-muted">{t("Comparar com")}</span>
                  <select
                    value={friendId}
                    onChange={(e) => setFriendId(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
                  >
                    <option value="">{t("ninguém")}</option>
                    {[...data.friends]
                      .sort((a, b) => a.onlineId.localeCompare(b.onlineId, locale(), { sensitivity: "base" }))
                      .map((f) => (
                        <option key={f.accountId} value={f.accountId}>
                          {f.onlineId}
                        </option>
                      ))}
                  </select>
                </label>

                {friend && (friendLoading || theirs.loading) && (
                  <Spinner label={t("Buscando os jogos de {name}…", { name: friend.onlineId })} />
                )}
                {friend && theirs.error ? <ErrorBox error={theirs.error} onRetry={theirs.refresh} /> : null}
                {friend && friendData && !friendTitles && (
                  <p className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
                    {t("Os troféus de {name} são privados, então não dá para comparar.", { name: friend.onlineId })}
                  </p>
                )}

                <Legend series={series(() => [])} />

                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["jogos", all.map((s) => s.games.toLocaleString(locale()))],
                      ["platinas", all.map((s) => s.platinums.toLocaleString(locale()))],
                      ["completos", all.map((s) => s.completed.toLocaleString(locale()))],
                      ["conclusao", all.map((s) => `${s.avgProgress}%`)],
                      ["trofeus", all.map((s) => s.totalTrophies.toLocaleString(locale()))],
                      ["tempo", all.map((s) => formatDuration(s.playSeconds))],
                    ] as [MuralCategory, string[]][]
                  ).map(([key, values]) => (
                    <StatTile
                      key={key}
                      label={t(MURAL_LABELS[key])}
                      names={names}
                      values={values}
                      selected={mural === key}
                      onSelect={() => setMural(key)}
                    />
                  ))}
                </div>

                {mural && (
                  <Mural
                    key={`${typeof mural === "object" ? mural.year : mural}:${friendId}`}
                    category={mural}
                    onClose={() => setMural(null)}
                    platform={platform}
                    players={[
                      {
                        name: names[0],
                        accountId: "me",
                        titles: data.titles,
                        playtime: data.playtime,
                        playedOn: data.playedOn,
                        firstPlayed: data.firstPlayed,
                      },
                      ...(friend && friendTitles && friendPlay
                        ? [
                            {
                              name: friend.onlineId,
                              accountId: friend.accountId,
                              titles: friendTitles,
                              playtime: friendPlay.playtime,
                              playedOn: friendPlay.playedOn,
                              firstPlayed: friendPlay.firstPlayed,
                            },
                          ]
                        : []),
                    ]}
                  />
                )}

                <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
                  <h2 className="font-semibold">{t("Troféus por tipo")}</h2>
                  <GroupedBars
                    categories={TYPES.map((t) => (
                      <TrophyBadge key={t} type={t} />
                    ))}
                    series={series((s) => TYPES.map((t) => s.trophies[t]))}
                  />
                  <div className="flex items-center gap-3 border-t border-line pt-3">
                    <span className="flex w-[5.5rem] shrink-0 items-center gap-1.5 text-sm font-semibold">
                      <AllTrophies />
                      {t("Total")}
                    </span>
                    <span className="flex flex-1 flex-wrap justify-end gap-x-4 gap-y-0.5">
                      {all.map((s, i) => (
                        <span key={names[i]} className="flex items-center gap-1.5 text-lg font-bold tabular-nums">
                          {all.length > 1 && (
                            <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                          )}
                          {s.totalTrophies.toLocaleString(locale())}
                        </span>
                      ))}
                    </span>
                  </div>
                </section>

                <YearStats
                  onSelectYear={(year) => setMural({ year })}
                  players={[
                    { name: names[0], titles: filterByPlatform(withEarnedTrophies(data.titles), platform, data.playedOn), firstPlayed: data.firstPlayed },
                    ...(friend && friendTitles && friendPlay
                      ? [
                          {
                            name: friend.onlineId,
                            titles: filterByPlatform(withEarnedTrophies(friendTitles), platform, friendPlay.playedOn),
                            firstPlayed: friendPlay.firstPlayed,
                          },
                        ]
                      : []),
                  ]}
                />

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

                <CompletionTimes titles={filterByPlatform(withEarnedTrophies(data.titles), platform, data.playedOn)} />

                {all.map((s, i) =>
                  s.topPlayed.length ? (
                    <MostPlayed
                      key={names[i]}
                      title={all.length > 1 ? `${t("Mais jogados")} · ${names[i]}` : t("Mais jogados")}
                      list={s.topPlayed}
                      accountId={i === 0 ? "me" : friendId}
                      color={SERIES_COLORS[i]}
                      note={t("Tempo disponível para {n} de {total} jogos (PS3 e Vita não registram).", {
                        n: s.gamesWithPlaytime,
                        total: s.games,
                      })}
                    />
                  ) : null,
                )}
          </>
        )}
          </>
        )}
      </div>
    </>
  );
}

/** Separa o resultado de `matchPlayed` em tempo por jogo e plataforma jogada por jogo. */
function playMaps(play: Map<string, PlayInfo>): {
  playtime: Map<string, number>;
  playedOn: PlayedOn;
  firstPlayed: Map<string, string | null>;
} {
  return {
    playtime: new Map([...play].map(([id, p]) => [id, p.seconds])),
    playedOn: new Map([...play].map(([id, p]) => [id, p.platform])),
    firstPlayed: new Map([...play].map(([id, p]) => [id, p.firstPlayed])),
  };
}

/** Os quatro troféus lado a lado: o ícone do total. */
function AllTrophies() {
  return (
    <span className="flex -space-x-1.5" aria-hidden>
      {TYPES.map((type) => (
        <TrophyIconOnly key={type} type={type} />
      ))}
    </span>
  );
}

const TROPHY_COLOR: Record<(typeof TYPES)[number], string> = {
  platinum: "text-platinum",
  gold: "text-gold",
  silver: "text-silver",
  bronze: "text-bronze",
};

function TrophyIconOnly({ type }: { type: (typeof TYPES)[number] }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 fill-current ${TROPHY_COLOR[type]}`}>
      <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z" />
    </svg>
  );
}

const MOST_PLAYED_STEP = 5;

/** Mais jogados: ícone do jogo, nome e barra de tempo; "Ver mais" mostra os próximos. */
function MostPlayed({
  title,
  list,
  accountId,
  color,
  note,
}: {
  title: string;
  list: { title: Title; seconds: number }[];
  accountId: string;
  color: string;
  note: string;
}) {
  const [count, setCount] = useState(MOST_PLAYED_STEP);
  const max = list[0]?.seconds || 1;
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">{title}</h2>
      <ul className="space-y-2.5">
        {list.slice(0, count).map((p, i) => (
          <li key={p.title.id}>
            <Link to={`/game/${accountId}/${p.title.id}?service=${p.title.service}`} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
              <GameIcon src={p.title.iconUrl} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.title.name}</span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-2 flex-1">
                    <span
                      className="block h-full rounded-r-[0.25rem]"
                      style={{ width: `${(p.seconds / max) * 100}%`, minWidth: 3, background: color }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">{formatDuration(p.seconds)}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length > MOST_PLAYED_STEP && (
        <button
          onClick={() => setCount((c) => (c >= list.length ? MOST_PLAYED_STEP : c + 10))}
          className="w-full text-sm font-semibold text-ps-blue-2"
        >
          {count >= list.length ? t("Mostrar menos") : t("Ver mais ({n})", { n: list.length - count })}
        </button>
      )}
      <p className="text-[0.6875rem] text-muted">{note}</p>
    </section>
  );
}

/** Jogos por ano, desde o primeiro jogo da conta, com as platinas de cada ano. */
function YearStats({
  players,
  onSelectYear,
}: {
  players: { name: string; titles: Title[]; firstPlayed: Map<string, string | null> }[];
  /** Toque no ano: abre o mural com os jogos daquele ano. */
  onSelectYear: (year: number) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const perPlayer = players.map((p) => gamesByYear(p.titles, p.firstPlayed));
  // Cada jogador já vem com todos os anos até hoje, então a união não tem buracos.
  const full = [...new Set(perPlayer.flatMap((rows) => rows.map((r) => r.year)))].sort((a, b) => b - a);
  if (!full.length) return null;
  const first = full[full.length - 1];
  const shown = showAll ? full : full.slice(0, 6);
  const row = (i: number, y: number) => perPlayer[i].find((r) => r.year === y);
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div>
        <h2 className="font-semibold">{t("📅 Jogos por ano")}</h2>
        <p className="text-[0.6875rem] text-muted">
          {t("Desde {year}, ano do primeiro jogo da conta. Toque no ano para ver os jogos.", { year: String(first) })}
        </p>
      </div>
      <GroupedBars
        categories={shown.map((y) => (
          <button
            key={y}
            onClick={() => onSelectYear(y)}
            aria-label={t("Ver os jogos de {year}", { year: String(y) })}
            className="flex items-center gap-1 rounded-lg font-semibold tabular-nums text-ps-blue-2 underline decoration-dotted underline-offset-4"
          >
            {y}
            <span aria-hidden className="text-xs text-muted no-underline">▸</span>
          </button>
        ))}
        series={players.map((p, i) => ({ name: p.name, values: shown.map((y) => row(i, y)?.games ?? 0) }))}
        format={(v) => (v === 1 ? t("{n} jogo", { n: v }) : t("{n} jogos", { n: v }))}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {shown.map((y) => {
          const plats = perPlayer.map((_, i) => row(i, y)?.platinums ?? 0);
          return plats.some((n) => n > 0) ? (
            <li key={y} className="flex items-center gap-1">
              <span className="font-semibold tabular-nums">{y}:</span>
              <TrophyIconOnly type="platinum" />
              {plats.join(" / ")}
            </li>
          ) : null;
        })}
      </ul>
      {full.length > 6 && (
        <button onClick={() => setShowAll((s) => !s)} className="w-full text-sm font-semibold text-ps-blue-2">
          {showAll ? t("Mostrar menos") : t("Ver todos os anos ({n})", { n: full.length })}
        </button>
      )}
      <p className="text-[0.6875rem] text-muted">
        {t("O ano é o da primeira vez que jogou (PS4 e PS5); para PS3 e Vita, o do último troféu.")}
      </p>
    </section>
  );
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
        <ConsoleArt platform={selected} className="h-11 w-11" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">
            {t("Plataformas jogadas · {n}", { n: platforms.length })}
          </span>
          <span className="block font-semibold">{selected ?? t("Todas as plataformas")}</span>
        </span>
        <span className="text-xs text-muted">{open ? t("Fechar") : t("Expandir")}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 border-t border-line p-3" role="radiogroup" aria-label={t("Plataforma")}>
          {[null, ...platforms].map((p) => (
            <button
              key={p ?? "todas"}
              role="radio"
              aria-checked={selected === p}
              onClick={() => pick(p)}
              className={`flex flex-col items-center rounded-xl border-2 p-3 text-center ${
                selected === p ? "border-ps-blue-2 bg-surface-2" : "border-line"
              }`}
            >
              <ConsoleArt platform={p} className="h-16 w-16" />
              <span className="mt-2 block font-semibold">{p ?? t("Todas")}</span>
              <span className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs text-muted">
                {totalOf(p).map((n, i) => (
                  <span key={counts[i].name} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                    {n === 1 ? t("{n} jogo", { n }) : t("{n} jogos", { n })}
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
        {players.length > 1
          ? t("Comparação por plataforma · {name}", { name: players[1].name })
          : t("Títulos por plataforma")}
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
  if (!list.length) return <p className="text-xs text-muted">{t("Nenhum jogo com troféus nesta plataforma.")}</p>;
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
          <p className="text-[0.6875rem] text-muted">{t("em comum")}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <p className="text-lg font-bold" style={{ color: SERIES_COLORS[0] }}>
            {ahead}
          </p>
          <p className="text-[0.6875rem] text-muted">{t("você na frente")}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <p className="text-lg font-bold" style={{ color: SERIES_COLORS[1] }}>
            {behind}
          </p>
          <p className="truncate text-[0.6875rem] text-muted">{t("{name} na frente", { name: friend.name })}</p>
        </div>
      </div>

      {common.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("Jogos em comum")}</p>
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
        { title: t("Só {name}", { name: me.name }), list: onlyMine, player: me, color: SERIES_COLORS[0] },
        { title: t("Só {name}", { name: friend.name }), list: onlyTheirs, player: friend, color: SERIES_COLORS[1] },
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
