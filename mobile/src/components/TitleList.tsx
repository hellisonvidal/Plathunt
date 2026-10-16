import { Link } from "react-router-dom";
import { formatDuration } from "../lib/stats";
import type { Title } from "../psn/types";
import { CompletionBadge, completionTier } from "./Completion";
import { GameIcon, TrophyBadge } from "./ui";

export function TitleList({
  titles,
  accountId,
  playtime,
}: {
  titles: Title[];
  accountId: string;
  playtime?: Map<string, number>;
}) {
  if (titles.length === 0) return <p className="py-8 text-center text-sm text-muted">Nenhum jogo encontrado.</p>;
  return (
    <ul className="space-y-3">
      {titles.map((t) => {
        const secs = playtime?.get(t.id);
        const tier = completionTier(t.progress);
        return (
          <li key={t.id}>
            <Link
              to={`/game/${accountId}/${t.id}?service=${t.service}`}
              className={`flex gap-3 rounded-2xl border bg-surface p-3 active:border-muted ${
                t.progress >= 100 ? "border-gold/50" : "border-line"
              }`}
            >
              <GameIcon src={t.iconUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-semibold">{t.name}</h2>
                  <span className="shrink-0 text-xs text-muted">{t.platform.replace("PSVITA", "PS Vita")}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {t.defined.platinum > 0 && <TrophyBadge type="platinum" count={t.earned.platinum} />}
                  <TrophyBadge type="gold" count={t.earned.gold} />
                  <TrophyBadge type="silver" count={t.earned.silver} />
                  <TrophyBadge type="bronze" count={t.earned.bronze} />
                  {secs ? <span className="ml-auto text-xs text-muted">⏱ {formatDuration(secs)}</span> : null}
                </div>
                {/* Marcação de conclusão: barra e selo na cor da faixa (ouro = 100%). */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className={`h-full rounded-full ${tier.bg}`} style={{ width: `${Math.min(100, t.progress)}%` }} />
                  </div>
                  <CompletionBadge progress={t.progress} />
                </div>
                {t.hasGroups && <p className="mt-1 text-[0.6875rem] text-muted">Inclui DLCs</p>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
