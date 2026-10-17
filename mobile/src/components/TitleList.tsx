import { Link } from "react-router-dom";
import { formatDuration } from "../lib/stats";
import type { Title } from "../psn/types";
import { CompletionBadge, completionTier, TierFill } from "./Completion";
import { GameIcon, TrophyBadge } from "./ui";
import { t } from "../i18n";

export function TitleList({
  titles,
  accountId,
  playtime,
}: {
  titles: Title[];
  accountId: string;
  playtime?: Map<string, number>;
}) {
  if (titles.length === 0) return <p className="py-8 text-center text-sm text-muted">{t("Nenhum jogo encontrado.")}</p>;
  return (
    <ul className="space-y-3">
      {titles.map((title) => {
        const secs = playtime?.get(title.id);
        const tier = completionTier(title.progress);
        return (
          <li key={title.id}>
            <Link
              to={`/game/${accountId}/${title.id}?service=${title.service}`}
              className={`flex gap-3 rounded-2xl border bg-surface p-3 active:border-muted ${
                title.progress >= 100 ? "border-ps-blue-2/60" : "border-line"
              }`}
            >
              <GameIcon src={title.iconUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-semibold">{title.name}</h2>
                  <span className="shrink-0 text-xs text-muted">{title.platform.replace("PSVITA", "PS Vita")}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {title.defined.platinum > 0 && <TrophyBadge type="platinum" count={title.earned.platinum} />}
                  <TrophyBadge type="gold" count={title.earned.gold} />
                  <TrophyBadge type="silver" count={title.earned.silver} />
                  <TrophyBadge type="bronze" count={title.earned.bronze} />
                  {secs ? <span className="ml-auto text-xs text-muted">⏱ {formatDuration(secs)}</span> : null}
                </div>
                {/* Marcação de conclusão: barra e selo na cor do tema, mais forte perto de 100%. */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <TierFill tier={tier} className="h-full rounded-full" style={{ width: `${Math.min(100, title.progress)}%` }} />
                  </div>
                  <CompletionBadge progress={title.progress} />
                </div>
                {title.hasGroups && <p className="mt-1 text-[0.6875rem] text-muted">{t("Inclui DLCs")}</p>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
