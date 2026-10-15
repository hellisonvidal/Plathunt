import { useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, GameIcon, ProgressBar, Spinner, TrophyBadge, rarityLabel } from "../components/ui";
import { useData } from "../lib/useData";
import type { Title } from "../psn/types";

const TYPE_ORDER: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

export function GamePage() {
  const { client } = useApp();
  const { accountId = "me", gameId = "" } = useParams();
  const [params] = useSearchParams();
  const service: Title["service"] = params.get("service") === "trophy" ? "trophy" : "trophy2";

  const { data, error, loading, refresh } = useData(
    async (force) => {
      const [titles, trophies, owner] = await Promise.all([
        client.titles(accountId, force),
        client.gameTrophies(accountId, { id: gameId, service }, force),
        accountId === "me" ? null : client.profile(accountId),
      ]);
      return { title: titles.find((t) => t.id === gameId) ?? null, trophies, owner };
    },
    [client, accountId, gameId, service],
  );

  const trophies = [...(data?.trophies ?? [])].sort(
    (a, b) => Number(b.earned) - Number(a.earned) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );
  const earnedCount = trophies.filter((t) => t.earned).length;

  return (
    <>
      <PageHeader title={data?.title?.name ?? "Jogo"} back onRefresh={refresh} refreshing={loading} />
      <div className="space-y-4 px-4 pt-4">
        {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
        {loading && !data && <Spinner />}

        {data && (
          <>
            <header className="flex gap-4">
              <GameIcon src={data.title?.iconUrl ?? null} size={80} />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold">{data.title?.name}</h2>
                <p className="text-sm text-muted">
                  {data.title?.platform}
                  {data.owner && ` · progresso de ${data.owner.onlineId}`}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={data.title?.progress ?? 0} />
                  <span className="text-sm text-muted">{data.title?.progress ?? 0}%</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {earnedCount} de {trophies.length} troféus
                </p>
              </div>
            </header>

            <ul className="space-y-2">
              {trophies.map((t) => {
                const locked = !t.earned;
                const secret = t.hidden && locked;
                const rarity = rarityLabel(t.rate);
                return (
                  <li
                    key={t.id}
                    className={`flex gap-3 rounded-xl border border-line bg-surface p-3 ${locked ? "opacity-60" : ""}`}
                  >
                    {t.iconUrl && !secret ? (
                      <img src={t.iconUrl} alt="" className={`h-12 w-12 shrink-0 rounded-lg ${locked ? "grayscale" : ""}`} />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                        {secret ? "?" : "🏆"}
                      </span>
                    )}
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
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
