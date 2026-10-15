import { Link } from "react-router-dom";
import type { Title } from "../psn/types";
import { GameIcon, ProgressBar, TrophyBadge } from "./ui";

export function TitleList({ titles, accountId }: { titles: Title[]; accountId: string }) {
  if (titles.length === 0) return <p className="py-8 text-center text-sm text-muted">Nenhum jogo encontrado.</p>;
  return (
    <ul className="space-y-3">
      {titles.map((t) => (
        <li key={t.id}>
          <Link
            to={`/game/${accountId}/${t.id}?service=${t.service}`}
            className="flex gap-3 rounded-2xl border border-line bg-surface p-3 active:border-muted"
          >
            <GameIcon src={t.iconUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate font-semibold">{t.name}</h2>
                <span className="shrink-0 text-xs text-muted">{t.platform}</span>
              </div>
              <div className="mt-1 flex gap-3">
                {t.defined.platinum > 0 && <TrophyBadge type="platinum" count={t.earned.platinum} />}
                <TrophyBadge type="gold" count={t.earned.gold} />
                <TrophyBadge type="silver" count={t.earned.silver} />
                <TrophyBadge type="bronze" count={t.earned.bronze} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar value={t.progress} />
                <span className="w-10 text-right text-xs text-muted">{t.progress}%</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
