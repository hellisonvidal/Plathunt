import { useEffect, useState } from "react";
import { t } from "../i18n";
import { useBackInterceptor } from "../lib/backButton";
import { buyPro, PRO_FEATURES, refreshPro, usePro, type ProFeature } from "../lib/pro";

/** Selo "Pro" ao lado de opções bloqueadas. */
export function ProBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gold px-1.5 py-px text-[0.625rem] font-bold text-black">
      🔒 Pro
    </span>
  );
}

/**
 * Tela "Plathunt Pro": o que a compra libera, o preço da loja e os botões de
 * comprar e restaurar. Sobe da parte de baixo; fecha no ✕, tocando fora ou no voltar.
 */
export function ProSheet({ feature, onClose }: { feature?: ProFeature; onClose: () => void }) {
  useBackInterceptor(true, onClose);
  const pro = usePro();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const buy = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await buyPro();
      if (r === "comprado") setMessage(t("Pronto! O Plathunt Pro está liberado. Obrigado pelo apoio! 💙"));
      else if (r === "pendente") setMessage(t("Pagamento em análise. O Pro é liberado assim que a Play Store confirmar."));
      else if (r === "indisponivel") setMessage(t("A compra só está disponível na versão da Play Store."));
    } catch {
      setMessage(t("Não deu para abrir a compra agora. Tente de novo."));
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    setBusy(true);
    setMessage(null);
    const s = await refreshPro();
    setBusy(false);
    setMessage(s.owned ? t("Compra restaurada. O Plathunt Pro está liberado.") : t("Nenhuma compra do Pro nesta conta do Google."));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-no-pull>
      <button aria-label={t("Fechar")} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Plathunt Pro"
        className="safe-bottom relative flex max-h-[85dvh] w-full max-w-2xl animate-[sheet-up_200ms_ease-out] flex-col overflow-y-auto rounded-t-3xl border border-line bg-bg px-4 pb-6 shadow-2xl"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
        <div className="flex items-center gap-2 pb-2 pt-3">
          <h2 className="flex-1 text-lg font-bold">⭐ Plathunt Pro</h2>
          <button
            onClick={onClose}
            aria-label={t("Fechar")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-lg text-muted"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm text-muted">
          {pro.owned ? t("Você já tem o Plathunt Pro. Obrigado pelo apoio!") : t("Compra única: paga uma vez e libera para sempre, nesta conta do Google.")}
        </p>
        <ul className="mb-4 space-y-2">
          {PRO_FEATURES.map((f) => (
            <li
              key={f.key}
              className={`flex items-start gap-3 rounded-2xl border p-3 ${
                f.key === feature ? "border-gold/40 bg-gold/10" : "border-line bg-surface"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {f.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t(f.label)}</span>
                <span className="block text-xs text-muted">{t(f.hint)}</span>
              </span>
            </li>
          ))}
        </ul>
        {!pro.owned && (
          <button
            disabled={busy}
            onClick={() => void buy()}
            className="mb-2 w-full rounded-full bg-ps-blue py-3 font-semibold disabled:opacity-60"
          >
            {pro.price ? t("Comprar por {price}", { price: pro.price }) : t("Comprar o Plathunt Pro")}
          </button>
        )}
        {!pro.owned && (
          <button disabled={busy} onClick={() => void restore()} className="w-full py-2 text-sm text-ps-blue-2 disabled:opacity-60">
            {t("Restaurar compra")}
          </button>
        )}
        {pro.pending && !pro.owned && !message && (
          <p className="mt-2 text-center text-xs text-muted">{t("Pagamento em análise. O Pro é liberado assim que a Play Store confirmar.")}</p>
        )}
        {message && (
          <p className="mt-2 text-center text-sm" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * Para recursos do Pro: `guard(ação)` faz a ação ou, sem o Pro, abre a tela
 * de compra; `sheet` é a tela, para pôr no JSX.
 */
export function useProGate(feature: ProFeature) {
  const { locked } = usePro();
  const [open, setOpen] = useState(false);
  return {
    locked,
    guard: (action: () => void) => (locked ? setOpen(true) : action()),
    openSheet: () => setOpen(true),
    sheet: open ? <ProSheet feature={feature} onClose={() => setOpen(false)} /> : null,
  };
}
