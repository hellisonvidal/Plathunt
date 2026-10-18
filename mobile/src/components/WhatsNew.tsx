import { useState } from "react";
import { t } from "../i18n";
import { useBackInterceptor } from "../lib/backButton";
import { LATEST_CHANGELOG } from "../lib/changelog";
import { appVersion, getSettings, updateSettings, useSettings } from "../lib/settings";

/** Janela com as novidades da versão instalada. */
export function WhatsNewDialog({ onClose }: { onClose: () => void }) {
  useBackInterceptor(true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-[calc(1rem+var(--sab))] pt-4 sm:items-center" data-no-pull>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="max-h-[85dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-2xl"
      >
        <h2 id="whats-new-title" className="text-lg font-semibold">
          {t("🎉 Novidades da versão {version}", { version: appVersion() })}
        </h2>
        <ul className="space-y-2.5 text-sm">
          {LATEST_CHANGELOG.items.map((item) => (
            <li key={item} className="leading-snug">
              {t(item)}
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="w-full rounded-xl bg-ps-blue py-2.5 text-sm font-semibold">
          {t("Entendi")}
        </button>
      </section>
    </div>
  );
}

/**
 * Mostra as novidades uma vez no primeiro acesso depois de uma atualização.
 * Numa instalação nova (sem sessão antes de abrir o app), só marca como vistas.
 */
export function WhatsNewOnUpdate({ updated, waitCloudNotice }: { updated: boolean; waitCloudNotice: boolean }) {
  // Se o aviso dos recursos online ainda vai aparecer, as novidades esperam ele fechar.
  const { cloudNoticeSeen } = useSettings();
  const [open, setOpen] = useState(() => {
    if (getSettings().changelogSeen >= LATEST_CHANGELOG.id) return false;
    if (!updated) {
      updateSettings({ changelogSeen: LATEST_CHANGELOG.id });
      return false;
    }
    return true;
  });
  if (!open || (waitCloudNotice && !cloudNoticeSeen)) return null;
  return (
    <WhatsNewDialog
      onClose={() => {
        updateSettings({ changelogSeen: LATEST_CHANGELOG.id });
        setOpen(false);
      }}
    />
  );
}
