import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, GameIcon, ProgressBar, RemoteImage, Spinner, TrophyBadge, rarityLabel } from "../components/ui";
import type { GroupSection } from "../lib/stats";
import { useSettings } from "../lib/settings";
import { gameWrittenGuideUrl, trophyGuideUrl, trophyWrittenGuideUrl, type GuideSite } from "../lib/tips";
import { formatDuration, groupTrophies, matchPlaytime } from "../lib/stats";
import { useData } from "../lib/useData";
import type { Title, TrophyRow } from "../psn/types";
import { QuickChallenge } from "../components/QuickChallenge";
import { platinumGoal, type Challenge } from "../lib/challenges";

/** Nomes usados nos links de guias: os oficiais em inglês, como nos sites. */
interface GuideNames {
  game: { name: string; platform: string };
  trophies: Record<number, string>;
}

const GUIDE_SITES: { site: GuideSite; label: string; domain: string }[] = [
  { site: "pst", label: "PlayStationTrophies", domain: "playstationtrophies.org" },
  { site: "psnp", label: "PSNProfiles", domain: "psnprofiles.com" },
];

/** Ícone do site (favicon); sem internet para a imagem, a inicial do nome. */
function SiteIcon({ domain, label, size }: { domain: string; label: string; size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-8 w-8 text-sm" : "h-4 w-4 text-[0.5625rem]";
  return (
    <RemoteImage
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      className={`${box} shrink-0 rounded-md bg-white object-contain p-0.5`}
      fallback={
        <span className={`${box} flex shrink-0 items-center justify-center rounded-md bg-surface-2 font-bold`} aria-hidden>
          {label[0]}
        </span>
      }
    />
  );
}
import { locale, t } from "../i18n";

type Filter = "todos" | "conquistados" | "bloqueados";
/** Nos jogos de um amigo: os troféus que você tem ou não. */
type MineFilter = "todos" | "tenho" | "naoTenho";

export function GamePage() {
  const { client } = useApp();
  const { accountId = "me", gameId = "" } = useParams();
  const [params] = useSearchParams();
  const service: Title["service"] = params.get("service") === "trophy" ? "trophy" : "trophy2";
  const [filter, setFilter] = useState<Filter>("todos");
  const [mineFilter, setMineFilter] = useState<MineFilter>("todos");
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

  // Os sites de guias usam os nomes em inglês; enquanto chegam (ou se a PSN
  // falhar), os links usam os nomes da tela.
  const english = useData(() => client.englishNames({ id: gameId, service }).catch(() => null), [client, gameId, service]);
  const guide: GuideNames | null = data?.title
    ? {
        game: { name: english.data?.name || data.title.name, platform: english.data?.platform || data.title.platform },
        trophies: english.data?.trophies ?? {},
      }
    : null;

  // Nos jogos de um amigo: botão de desafio em cada troféu. Quem já tem o
  // troféu não conta no desafio (a tela do desafio avisa).
  const [challenge, setChallenge] = useState<{ trophy: Challenge["trophy"]; friendHas: boolean; iHave: boolean } | null>(
    null,
  );
  const friend = accountId !== "me" ? (data?.owner ?? null) : null;
  const mine = useData(
    async () => (accountId === "me" ? null : await client.gameTrophies("me", { id: gameId, service }).catch(() => [])),
    [client, accountId, gameId, service],
  );
  const iHave = new Set((mine.data ?? []).filter((r) => r.earned).map((r) => r.id));
  const onChallenge =
    friend && data?.title && mine.data
      ? (row: TrophyRow) =>
          setChallenge({
            trophy: { id: row.id, name: row.name, detail: row.detail, type: row.type, iconUrl: row.iconUrl, rate: row.rate },
            friendHas: row.earned,
            iHave: iHave.has(row.id),
          })
      : undefined;
  const platinumRace = !!data?.title && data.title.defined.platinum > 0;

  const all = data?.trophies ?? [];
  const earnedCount = all.filter((t) => t.earned).length;
  // Ordem original da PlayStation (a do jogo), conquistados ou não.
  const visible = all
    .filter((t) => (filter === "conquistados" ? t.earned : filter === "bloqueados" ? !t.earned : true))
    .filter((t) => (mineFilter === "tenho" ? iHave.has(t.id) : mineFilter === "naoTenho" ? !iHave.has(t.id) : true))
    .sort((a, b) => a.id - b.id);
  // As seções contam sempre todos os troféus do grupo; o filtro só esconde linhas.
  const sections = data ? groupTrophies(all, data.groups) : [];

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "todos", label: t("Todos"), count: all.length },
    { key: "conquistados", label: t("Conquistados"), count: earnedCount },
    { key: "bloqueados", label: t("Bloqueados"), count: all.length - earnedCount },
  ];
  const myCount = all.filter((t) => iHave.has(t.id)).length;
  const MINE_FILTERS: { key: MineFilter; label: string; count: number }[] = [
    { key: "todos", label: t("Todos"), count: all.length },
    { key: "tenho", label: t("Você tem"), count: myCount },
    { key: "naoTenho", label: t("Você não tem"), count: all.length - myCount },
  ];
  const platinumBoth =
    !!data?.title && data.title.earned.platinum > 0 && (mine.data ?? []).some((r) => r.type === "platinum" && r.earned);

  return (
    <>
      <PageHeader title={data?.title?.name ?? t("Jogo")} back onRefresh={refresh} refreshing={loading} />
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
                  {t("{earned} de {total} troféus", { earned: earnedCount, total: all.length })}
                </p>
              </div>
            </header>

            {friend && data.title && mine.data && (
              <div className="flex items-center gap-3 rounded-2xl border border-ps-blue-2/40 bg-ps-blue-2/10 p-3">
                <span className="text-2xl" aria-hidden>
                  🏁
                </span>
                <p className="min-w-0 flex-1 text-xs text-muted">
                  {t("Desafie {name}: toque em ⚔️ Desafiar em qualquer troféu da lista, ou faça a corrida da platina.", {
                    name: friend.onlineId,
                  })}
                </p>
                {platinumRace && (
                  <button
                    disabled={platinumBoth}
                    title={platinumBoth ? t("Vocês dois já têm a platina") : undefined}
                    onClick={() =>
                      setChallenge({
                        trophy: platinumGoal(),
                        friendHas: data.title!.earned.platinum > 0,
                        iHave: (mine.data ?? []).some((r) => r.type === "platinum" && r.earned),
                      })
                    }
                    className="shrink-0 rounded-full bg-ps-blue px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  >
                    {t("🏆 Platina")}
                  </button>
                )}
              </div>
            )}

            {friend && data.title && challenge && (
              <QuickChallenge
                game={data.title}
                trophy={challenge.trophy}
                friendHas={challenge.friendHas}
                iHave={challenge.iHave}
                friend={friend}
                onClose={() => setChallenge(null)}
              />
            )}

            {/* Guias completos lado a lado, com o ícone de cada site. */}
            {guide && (
              <div className="grid grid-cols-2 gap-2">
                {GUIDE_SITES.map(({ site, label, domain }) => (
                  <a
                    key={site}
                    href={gameWrittenGuideUrl(site, guide.game)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 active:bg-surface-2"
                  >
                    <SiteIcon domain={domain} label={label} size="lg" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{t("Guia completo")}</span>
                      <span className="block truncate text-xs text-muted">{label}</span>
                    </span>
                  </a>
                ))}
              </div>
            )}

            <div className="space-y-1">
              {friend && <p className="px-1 text-xs text-muted">{t("Troféus de {name}", { name: friend.onlineId })}</p>}
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
            </div>

            {/* Jogo de um amigo: filtra também pelos troféus que você tem. */}
            {friend && mine.data && (
              <div className="space-y-1">
                <p className="px-1 text-xs text-muted">{t("Seus troféus neste jogo")}</p>
                <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-surface p-1 text-sm">
                  {MINE_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      role="tab"
                      aria-selected={mineFilter === f.key}
                      onClick={() => setMineFilter(f.key)}
                      className={`truncate rounded-full px-1 py-1.5 ${mineFilter === f.key ? "bg-ps-blue font-semibold" : "text-muted"}`}
                    >
                      {f.label} <span className="opacity-70">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sections.map((section) => (
              <GroupList
                key={section.group.id}
                section={section}
                gameName={data.title?.name ?? ""}
                guide={guide}
                onChallenge={onChallenge}
                mine={friend && mine.data ? iHave : null}
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
  guide,
  onChallenge,
  mine,
  rows,
  filter,
  expanded,
  onToggle,
}: {
  section: GroupSection;
  gameName: string;
  guide: GuideNames | null;
  /** Nos jogos de um amigo: abre o desafio rápido no troféu. */
  onChallenge?: (row: TrophyRow) => void;
  /** Nos jogos de um amigo: os troféus que você tem. */
  mine: Set<number> | null;
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
          {section.isBase ? t("Jogo base") : "DLC"}
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
              {filter === "conquistados" ? t("Nenhum troféu conquistado aqui ainda.") : t("Tudo conquistado aqui! 🏆")}
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((t) => (
                <TrophyItem
                  key={t.id}
                  trophy={t}
                  gameName={gameName}
                  guide={guide}
                  onChallenge={onChallenge ? () => onChallenge(t) : undefined}
                  iHave={mine ? mine.has(t.id) : null}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TrophyItem({
  trophy,
  gameName,
  guide,
  onChallenge,
  iHave,
}: {
  trophy: TrophyRow;
  gameName: string;
  guide: GuideNames | null;
  onChallenge?: () => void;
  /** Nos jogos de um amigo: se você também tem o troféu (null fora disso). */
  iHave: boolean | null;
}) {
  const { revealSecrets, language } = useSettings();
  const locked = !trophy.earned;
  const secret = trophy.hidden && locked && !revealSecrets;
  const rarity = rarityLabel(trophy.rate);
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className={`flex gap-3 ${locked ? "opacity-60" : ""}`}>
        <RemoteImage
          src={secret ? null : trophy.iconUrl}
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
            <span className="font-medium">{secret ? t("Troféu secreto") : trophy.name}</span>
            <TrophyBadge type={trophy.type} />
          </div>
          {!secret && trophy.detail && <p className="text-sm text-muted">{trophy.detail}</p>}
          {(trophy.earnedAt || rarity) && (
            <p className="mt-1 text-xs text-ps-blue-2">
              {trophy.earnedAt &&
                // Data e hora exatas da conquista (no fuso do celular).
                t("Conquistado em {date} às {time}", {
                  date: new Date(trophy.earnedAt).toLocaleDateString(locale()),
                  time: new Date(trophy.earnedAt).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }),
                })}
              {trophy.earnedAt && rarity && " · "}
              {rarity}
            </p>
          )}
          {iHave !== null && (
            <p className={`mt-1 text-xs font-semibold ${iHave ? "text-online" : "text-muted"}`}>
              {iHave ? t("✓ Você tem") : t("Você ainda não tem")}
            </p>
          )}
        </div>
      </div>
      {trophy.progress && !trophy.earned && !secret && (
        <div className="ml-15 mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">{t("Progresso do objetivo")}</span>
            <span className="font-semibold tabular-nums">
              {trophy.progress.current.toLocaleString(locale())}/{trophy.progress.target.toLocaleString(locale())}
            </span>
          </div>
          <div className="mt-1">
            <ProgressBar value={(trophy.progress.current / trophy.progress.target) * 100} />
          </div>
        </div>
      )}
      {/* Abre no app do YouTube (ou no navegador) a busca por um vídeo de dicas.
          Usa o nome original do troféu: a tradução automática acha menos vídeos. */}
      <div className="mt-2 flex flex-wrap gap-2">
        {/* Se vocês dois já têm o troféu, não há o que disputar: o desafio fica bloqueado. */}
        {onChallenge &&
          (trophy.earned && iHave ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-muted">
              <span aria-hidden>🔒</span>
              {t("Vocês dois já têm")}
            </span>
          ) : (
            <button
              onClick={onChallenge}
              className="inline-flex items-center gap-1.5 rounded-full bg-ps-blue px-3 py-1 text-xs font-semibold"
            >
              <span aria-hidden>⚔️</span>
              {t("Desafiar")}
            </button>
          ))}
        <a
          href={trophyGuideUrl(gameName, trophy.originalName ?? trophy.name, language)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink active:bg-surface-2"
        >
          <span className="text-[#ff3d3d]" aria-hidden>
            ▶
          </span>
          {secret ? t("Dica em vídeo (spoiler)") : t("Dica em vídeo")}
        </a>
        {/* Guias escritos do PlayStationTrophies.org e do PSNProfiles, com os nomes em inglês. */}
        {guide &&
          GUIDE_SITES.map(({ site, label, domain }) => (
            <a
              key={site}
              href={trophyWrittenGuideUrl(site, guide.game, guide.trophies[trophy.id] || trophy.originalName || trophy.name)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink active:bg-surface-2"
            >
              <SiteIcon domain={domain} label={label} size="sm" />
              {label}
            </a>
          ))}
      </div>
    </li>
  );
}
