import { useEffect, useState } from "react";
import { t } from "../i18n";
import { cloudIdentity, connectCloud, disconnectCloud, PRIVACY_URL } from "../lib/cloud";
import { getSettings, updateSettings } from "../lib/settings";

/** Liga os recursos online sem incomodar (sem rede, tenta de novo na próxima abertura). */
async function connectQuietly() {
  if (await cloudIdentity()) return;
  await connectCloud().catch(() => {});
}

/**
 * Recursos online vêm ligados: na primeira abertura com a PSN, um aviso
 * explica o que vai para o servidor e deixa o jogador manter ou desligar.
 * Depois disso, reconecta sozinho, a não ser que ele tenha desligado
 * (em Configurações → Recursos online dá para mudar a qualquer momento).
 */
export function CloudNotice() {
  const [open, setOpen] = useState(() => !getSettings().cloudNoticeSeen);

  useEffect(() => {
    const { cloudNoticeSeen, cloudOff } = getSettings();
    if (cloudNoticeSeen && !cloudOff) void connectQuietly();
  }, []);

  if (!open) return null;

  const choose = (keep: boolean) => {
    updateSettings({ cloudNoticeSeen: true, cloudOff: !keep });
    setOpen(false);
    void (keep ? connectQuietly() : disconnectCloud());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-[calc(1rem+var(--sab))] pt-4 sm:items-center" data-no-pull>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-notice-title"
        className="w-full max-w-md space-y-3 rounded-3xl border border-line bg-surface p-5 shadow-2xl"
      >
        <h2 id="cloud-notice-title" className="text-lg font-semibold">
          {t("🌐 Recursos online ativados")}
        </h2>
        <p className="text-sm text-muted">
          {t(
            "Com os recursos online, suas curtidas chegam ao dono da conquista e os pedidos de boost vão direto para o app dos amigos que também usam o Trophy Mania. Ficam guardados no servidor do app só seu ID e avatar da PSN, suas curtidas e seus pedidos de boost.",
          )}{" "}
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="text-ps-blue-2 underline">
            {t("Política de privacidade")}
          </a>
        </p>
        <p className="text-xs text-muted">{t("Você pode mudar isso quando quiser em Configurações → Recursos online.")}</p>
        <div className="flex gap-2 pt-1">
          <button onClick={() => choose(false)} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold">
            {t("Desligar")}
          </button>
          <button onClick={() => choose(true)} className="flex-1 rounded-xl bg-ps-blue py-2.5 text-sm font-semibold">
            {t("Manter ligados")}
          </button>
        </div>
      </section>
    </div>
  );
}
