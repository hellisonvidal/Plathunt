import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApp } from "../app";
import { CompletionSummary } from "../components/Completion";
import { PageHeader } from "../components/PageHeader";
import { TitleList } from "../components/TitleList";
import { Avatar, ErrorBox, ProgressBar, Spinner, TrophyBadge } from "../components/ui";
import { formatDuration, matchPlaytime } from "../lib/stats";
import { useData } from "../lib/useData";
import { PsPlusIcon } from "../components/icons";
import { t } from "../i18n";

type Sort = "recentes" | "antigos" | "progresso" | "tempo";

/** Perfil: o seu (aba 1) ou o de um amigo (/u/:accountId). */
export function ProfilePage() {
  const { client } = useApp();
  const { accountId = "me" } = useParams();
  const isMe = accountId === "me";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recentes");

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

  const titles = (data?.titles ?? [])
    .filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
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
                    <option value="antigos">{t("Menos recentes")}</option>
                    <option value="progresso">{t("Progresso")}</option>
                    <option value="tempo">{t("Tempo de jogo")}</option>
                  </select>
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
