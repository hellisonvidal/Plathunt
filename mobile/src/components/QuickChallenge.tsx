import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { t } from "../i18n";
import { useBackInterceptor } from "../lib/backButton";
import { addChallenge, CHALLENGE_DEADLINES, type Challenge } from "../lib/challenges";
import { useData } from "../lib/useData";
import type { Profile, Title } from "../psn/types";
import { scheduleDeadlineReminder } from "./Challenges";
import { Avatar, GameIcon, TrophyBadge } from "./ui";

/**
 * Desafio rápido a partir dos jogos de um amigo: o jogo e o troféu já vêm
 * escolhidos e o rival é o amigo; só falta o prazo. O desafio aparece em
 * Atividades → Desafios.
 */
export function QuickChallenge({
  game,
  trophy,
  friend,
  onClose,
}: {
  game: Title;
  trophy: Challenge["trophy"];
  friend: Profile;
  onClose: () => void;
}) {
  const { client } = useApp();
  useBackInterceptor(true, onClose);
  const me = useData((force) => client.me(force), [client]);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [created, setCreated] = useState(false);

  const create = () => {
    if (!me.data) return;
    const challenge = addChallenge(
      {
        game: { name: game.name, iconUrl: game.iconUrl, titleId: game.id, service: game.service, platform: game.platform },
        trophy,
        players: [
          { accountId: "me", onlineId: me.data.onlineId, avatarUrl: me.data.avatarUrl },
          { accountId: friend.accountId, onlineId: friend.onlineId, avatarUrl: friend.avatarUrl },
        ],
      },
      deadline,
    );
    scheduleDeadlineReminder(challenge);
    setCreated(true);
  };

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" data-no-pull>
      <button aria-label={t("Fechar")} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("Desafiar {name}", { name: friend.onlineId })}
        className="safe-bottom relative w-full max-w-2xl animate-[sheet-up_200ms_ease-out] space-y-4 rounded-t-3xl border border-line bg-surface p-4 pb-6 shadow-2xl"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <h2 className="font-bold">{t("🏁 Desafiar {name}", { name: friend.onlineId })}</h2>

        <div className="flex items-center gap-3 rounded-xl border border-line p-2">
          <GameIcon src={game.iconUrl} size={40} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{trophy.name}</span>
              <TrophyBadge type={trophy.type} />
            </span>
            <span className="block truncate text-[0.6875rem] text-muted">{game.name}</span>
          </span>
          <Avatar src={friend.avatarUrl} name={friend.onlineId} size={32} />
        </div>

        {created ? (
          <div className="space-y-3 text-center">
            <p className="font-semibold">{t("✅ Desafio criado!")}</p>
            <p className="text-xs text-muted">
              {t("Vence quem conquistar o troféu primeiro. Acompanhe em Atividades → Desafios.")}
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold">
                {t("Fechar")}
              </button>
              <Link
                to="/activity?view=challenges"
                className="flex-1 rounded-xl bg-ps-blue py-2.5 text-center text-sm font-semibold"
              >
                {t("Ver desafios")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-1.5 text-xs text-muted">{t("Prazo")}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Prazo")}>
                {CHALLENGE_DEADLINES.map((d) => (
                  <button
                    key={String(d.days)}
                    role="radio"
                    aria-checked={deadline === d.days}
                    onClick={() => setDeadline(d.days)}
                    className={chip(deadline === d.days)}
                  >
                    {t(d.label)}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={create}
              disabled={!me.data}
              className="w-full rounded-xl bg-ps-blue py-3 font-semibold disabled:opacity-50"
            >
              {t("Começar desafio")}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
