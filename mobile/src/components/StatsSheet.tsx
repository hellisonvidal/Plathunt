import { useEffect } from "react";
import { t } from "../i18n";
import { useBackInterceptor } from "../lib/backButton";
import { PlayerStats } from "../pages/Stats";
import type { Profile } from "../psn/types";

/**
 * Pop-up com as estatísticas de um amigo (as mesmas da aba Estatísticas),
 * aberto pelo botão "Estatísticas" na aba Amigos. Fecha no ✕, tocando fora ou
 * no voltar.
 */
export function FriendStatsSheet({ friend, onClose }: { friend: Profile; onClose: () => void }) {
  useBackInterceptor(true, onClose);
  // A página de trás não rola enquanto o pop-up está aberto.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const heading = t("Estatísticas de {name}", { name: friend.onlineId });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" data-no-pull>
      <button aria-label={t("Fechar")} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="safe-bottom relative flex max-h-[90dvh] w-full max-w-2xl animate-[sheet-up_200ms_ease-out] flex-col rounded-t-3xl border border-line bg-bg shadow-2xl"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
          <h2 className="min-w-0 flex-1 truncate font-semibold">{heading}</h2>
          <button
            onClick={onClose}
            aria-label={t("Fechar")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-lg text-muted"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-6">
          <PlayerStats accountId={friend.accountId} name={friend.onlineId} />
        </div>
      </section>
    </div>
  );
}
