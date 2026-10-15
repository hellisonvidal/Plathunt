import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, GameIcon, ProgressBar, RemoteImage, Spinner, TrophyBadge, rarityLabel } from "../components/ui";
import type { GroupSection } from "../lib/stats";
import { useSettings } from "../lib/settings";
import { trophyGuideUrl } from "../lib/tips";
import { formatDuration, groupTrophies, matchPlaytime } from "../lib/stats";
import { useData } from "../lib/useData";
import type { Title, TrophyRow } from "../psn/types";

const TYPE_ORDER: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
type Filter = "todos" | "conquistados" | "bloqueados";

export function GamePage() {
  const { client } = useApp();
  const { accountId = "me", gameId = "" } = useParams();
  const [params] = useSearchParams();
  const service: Title["service"] = params.get("service") === "trophy" ? "trophy" : "trophy2";
  const [filter, setFilter] = useState<Filter>("todos");
  // Listas abertas (jogo base / DLCs). Fechadas por padrão; com uma lista só, ela já vem aberta.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { data, error, loading, refresh } = useData(
    async (force) => {
      const game = { id: gameId, service };
      const [titles, trophies, groups, played, owner] = await Promise.all([
        client.titles(accountId, force),
        client.gameTrophies(accountId, game, force),
        client.trophyGroups(game).catch(() => []),
        client.playedGames(accountId, force),
        accountId === "me" ? null : client.profile(accountId),
      ]);
      const title = titles.find((t) => t.id === gameId) ?? null;
      const playSeconds = title && played ? (matchPlaytime([title], played).get(title.id) ?? 0) : 0;
      return { title, trophies, groups, owner, playSeconds };
    },
    [client, accountId, gameId, service],
  );

  const all = data?.trophies ?? [];
  const earnedCount = all.filter((t) => t.earned).length;
  const visible = all
    .filter((t) => (filter === "conquistados" ? t.earned : filter === "bloqueados" ? !t.earned : true))
    .sort((a, b) => Number(b.earned) - Number(a.earned) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.id - b.id);
  // As seções contam sempre todos os troféus do grupo; o filtro só esconde linhas.
  const sections = data ? groupTrophies(all, data.groups) : [];

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: all.length },
    { key: "conquistados", label: "Conquistados", count: earnedCount },
    { key: "bloqueados", label: "Bloqueados", count: all.length - earnedCount },
  ];

  return (
    <>
      <PageHeader title={data?.title?.name ?? "Jogo"} back onRefresh={refresh} refreshing={loading} />
      <div className="space-y-4 px-4 pt-4">
        {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
        {loading && !data && <Spinner />}

        {data && (
          <>
            <header className="flex gap-4">
              <GameIcon src={data.title?.iconUrl ?? null} size={84} />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold leading-tight">{data.title?.name}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {data.title?.platform.replace("PSVITA", "PS Vita")}
                  {data.playSeconds > 0 && ` · ⏱ ${formatDuration(data.playSeconds)}`}
                  {data.owner && ` · ${data.owner.onlineId}`}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={data.title?.progress ?? 0} />
                  <span className="text-sm text-muted">{data.title?.progress ?? 0}%</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {earnedCount} de {all.length} troféus
                </p>
              </div>
            </header>

            <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-surface p-1 text-sm">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full py-1.5 ${filter === f.key ? "bg-ps-blue font-semibold" : "text-muted"}`}
                >
                  {f.label} <span className="opacity-70">{f.count}</span>
                </button>
              ))}
            </div>

            {sections.map((section) => (
              <GroupList
                key={section.group.id}
                section={section}
                gameName={data.title?.name ?? ""}
                rows={visible.filter((t) => section.trophies.includes(t))}
                filter={filter}
                expanded={sections.length === 1 || open.has(section.group.id)}
                onToggle={sections.length === 1 ? undefined : () => toggle(section.group.id)}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

/** Uma lista de troféus (jogo base ou DLC) que abre e fecha ao tocar no cabeçalho. */
function GroupList({
  section,
  gameName,
  rows,
  filter,
  expanded,
  onToggle,
}: {
  section: GroupSection;
  gameName: string;
  rows: TrophyRow[];
  filter: Filter;
  expanded: boolean;
  onToggle?: () => void;
}) {
  const total = section.trophies.length;
  const percent = total ? Math.round((section.earned / total) * 100) : 0;
  const header = (
    <>
      <RemoteImage
        src={section.group.iconUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-lg object-cover"
        fallback={
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-lg">
            {section.isBase ? "🎮" : "🧩"}
          </span>
        }
      />
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ps-blue-2">
          {section.isBase ? "Jogo base" : "DLC"}
        </p>
        <h3 className="truncate font-semibold">{section.group.name}</h3>
        <div className="mt-1.5 flex items-center gap-2">
          <ProgressBar value={percent} />
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {section.earned}/{total}
          </span>
        </div>
      </div>
      {onToggle && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`h-5 w-5 shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      )}
    </>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      {onToggle ? (
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-center gap-3 p-3 text-left active:bg-surface-2"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-center gap-3 p-3">{header}</div>
      )}

      {expanded && (
        <div className="border-t border-line bg-bg/40 p-2">
          {rows.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted">
              {filter === "conquistados" ? "Nenhum troféu conquistado aqui ainda." : "Tudo conquistado aqui! 🏆"}
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((t) => (
                <TrophyItem key={t.id} trophy={t} gameName={gameName} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TrophyItem({ trophy: t, gameName }: { trophy: TrophyRow; gameName: string }) {
  const { revealSecrets, language } = useSettings();
  const locked = !t.earned;
  const secret = t.hidden && locked && !revealSecrets;
  const rarity = rarityLabel(t.rate);
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className={`flex gap-3 ${locked ? "opacity-60" : ""}`}>
        <RemoteImage
          src={secret ? null : t.iconUrl}
          alt=""
          className={`h-12 w-12 shrink-0 rounded-lg ${locked ? "grayscale" : ""}`}
          fallback={
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2">
              {secret ? "?" : locked ? "🔒" : "🏆"}
            </span>
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{secret ? "Troféu secreto" : t.name}</span>
            <TrophyBadge type={t.type} />
          </div>
          {!secret && t.detail && <p className="text-sm text-muted">{t.detail}</p>}
          {(t.earnedAt || rarity) && (
            <p className="mt-1 text-xs text-ps-blue-2">
              {t.earnedAt && `Conquistado em ${new Date(t.earnedAt).toLocaleDateString("pt-BR")}`}
              {t.earnedAt && rarity && " · "}
              {rarity}
            </p>
          )}
        </div>
      </div>
      {/* Abre no app do YouTube (ou no navegador) a busca por um vídeo de dicas. */}
      <a
        href={trophyGuideUrl(gameName, t.name, language)}
        target="_blank"
        rel="noreferrer"
        className="ml-15 mt-2 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink active:bg-surface-2"
      >
        <span className="text-[#ff3d3d]" aria-hidden>
          ▶
        </span>
        {secret ? "Dicas no YouTube (pode ter spoiler)" : "Dicas no YouTube"}
      </a>
    </li>
  );
}
