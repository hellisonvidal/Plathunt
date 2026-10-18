import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApp } from "../app";
import { CompletionSummary } from "../components/Completion";
import { PageHeader } from "../components/PageHeader";
import { TitleList } from "../components/TitleList";
import { Avatar, ErrorBox, ProgressBar, Spinner, TrophyBadge } from "../components/ui";
import { formatDuration, isComplete, matchPlaytime } from "../lib/stats";
import { useData } from "../lib/useData";
import { PsPlusIcon } from "../components/icons";
import { t } from "../i18n";
import type { Title } from "../psn/types";

type Sort = "recentes" | "antigos" | "progresso" | "tempo";
type Filter = "todos" | "platinados" | "semPlatina" | "completos" | "incompletos";

/** Filtros da lista de jogos. "Sem platina": jogos em que você ainda não tem a platina (ou que não têm). */
const FILTERS: { key: Filter; label: string; test: (t: Title) => boolean }[] = [
  { key: "todos", label: "Todos", test: () => true },
  { key: "platinados", label: "Com platina", test: (t) => t.earned.platinum > 0 },
  { key: "semPlatina", label: "Sem platina", test: (t) => t.earned.platinum === 0 },
  // 100% só de jogos com DLC (sem DLC, o 100% é a própria platina).
  { key: "completos", label: "💯 100%", test: isComplete },
  { key: "incompletos", label: "Em andamento", test: (t) => t.progress < 100 },
];

/** Perfil: o seu (aba 1) ou o de um amigo (/u/:accountId). */
export function ProfilePage() {
  const { client } = useApp();
  const { accountId = "me" } = useParams();
  const isMe = accountId === "me";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recentes");
  const [filter, setFilter] = useState<Filter>("todos");

  const { data, error, loading, refresh } = useData(
    async (force) => {
      const [profile, titles, played] = await Promise.all([
        isMe ? client.me(force) : client.profile(accountId, force),
        // Troféus privados: a PSN recusa a lista de jogos.
        client.titles(accountId, force).catch(() => null),
        client.playedGames(accountId, force),
      ]);
      const playtime = titles && played ? matchPlaytime(titles, played) : new Map<string, number>();
      // Nome verdadeiro, quando o jogador compartilha na PSN.
      const realName = await client.realName(profile.onlineId, force).catch(() => null);
      return { profile, titles, playtime, realName };
    },
    [client, accountId],
  );

  const filterTest = FILTERS.find((f) => f.key === filter)!.test;
  const titles = (data?.titles ?? [])
    .filter((t) => filterTest(t) && t.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === "progresso") return b.progress - a.progress;
      if (sort === "tempo") return (data!.playtime.get(b.id) ?? 0) - (data!.playtime.get(a.id) ?? 0);
      const recent = new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      return sort === "antigos" ? -recent : recent;
    });
  const totalPlay = data ? [...data.playtime.values()].reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <PageHeader
        title={isMe ? t("Perfil") : (data?.profile.onlineId ?? t("Perfil"))}
        back={!isMe}
        onRefresh={refresh}
        refreshing={loading}
      />
      <div className="space-y-4 px-4 pt-4">
        {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
        {loading && !data && <Spinner label={t("Carregando perfil e jogos…")} />}

        {data && (
          <>
            <section className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-4">
                <Avatar src={data.profile.avatarUrl} name={data.profile.onlineId} size={84} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold">{data.profile.onlineId}</h2>
                  {data.realName && <p className="truncate text-sm font-medium text-muted">{data.realName}</p>}
                  <PsPlusInfo isPlus={data.profile.isPlus} />
                  {data.profile.aboutMe && <p className="mt-0.5 text-sm text-muted">{data.profile.aboutMe}</p>}
                </div>
              </div>

              {data.profile.earned ? (
                <>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="rounded-lg bg-ps-blue px-2 py-1 text-sm font-bold">
                      {t("Nv. {n}", { n: data.profile.level ?? "" })}
                    </span>
                    <div className="flex-1">
                      <ProgressBar value={data.profile.levelProgress ?? 0} />
                    </div>
                    <span className="text-xs text-muted">{data.profile.levelProgress ?? 0}%</span>
                  </div>
                  {/* Total de troféus logo abaixo do nível. */}
                  <p className="mt-2 text-sm">
                    {t("{n} troféus no total", {
                      n:
                        data.profile.earned.platinum +
                        data.profile.earned.gold +
                        data.profile.earned.silver +
                        data.profile.earned.bronze,
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    <TrophyBadge type="platinum" count={data.profile.earned.platinum} />
                    <TrophyBadge type="gold" count={data.profile.earned.gold} />
                    <TrophyBadge type="silver" count={data.profile.earned.silver} />
                    <TrophyBadge type="bronze" count={data.profile.earned.bronze} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {t("{n} jogos", { n: data.titles?.length ?? 0 })}
                    {totalPlay > 0 && t(" · ⏱ {time} jogados", { time: formatDuration(totalPlay) })}
                  </p>
                  {data.titles && <CompletionSummary titles={data.titles} />}
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">{t("Os troféus deste perfil são privados.")}</p>
              )}
            </section>

            {data.titles && (
              <>
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("Buscar jogo")}
                    className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
                  />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    aria-label={t("Ordenar jogos")}
                    className="rounded-full border border-line bg-surface-2 px-3 text-sm"
                  >
                    <option value="recentes">{t("Recentes")}</option>
                    <option value="antigos">{t("Mais antigos")}</option>
                    <option value="progresso">{t("Progresso")}</option>
                    <option value="tempo">{t("Tempo de jogo")}</option>
                  </select>
                </div>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={t("Filtrar jogos")}>
                  {FILTERS.map((f) => {
                    const n = data.titles!.filter(f.test).length;
                    return (
                      <button
                        key={f.key}
                        role="radio"
                        aria-checked={filter === f.key}
                        onClick={() => setFilter(f.key)}
                        className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          filter === f.key ? "border-ps-blue-2 bg-ps-blue" : "border-line bg-surface text-muted"
                        }`}
                      >
                        {f.key === "platinados" && <PlatinumIcon />}
                        {t(f.label)} · {n}
                      </button>
                    );
                  })}
                </div>
                <TitleList titles={titles} accountId={accountId} playtime={data.playtime} />
                {data.playtime.size === 0 && data.titles.length > 0 && (
                  <p className="text-center text-xs text-muted">
                    {t("O tempo de jogo não está disponível para este perfil (ou só há jogos de PS3/Vita).")}
                  </p>
                )}
              </>
            )}

          </>
        )}
      </div>
    </>
  );
}

/** Selo do PlayStation Plus (a PSN só informa se a conta é assinante). */
function PsPlusInfo({ isPlus }: { isPlus: boolean }) {
  if (!isPlus) return null;
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-gold">
      <PsPlusIcon size={16} />
      PlayStation Plus
    </p>
  );
}

/** Troféu de platina (o mesmo desenho dos contadores de troféus). */
function PlatinumIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current text-platinum" aria-hidden>
      <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z" />
    </svg>
  );
}
