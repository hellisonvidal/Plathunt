import { useState } from "react";
import { t } from "../i18n";
import { forgetSaved, switchAccount, useSavedAccounts } from "../lib/accounts";
import type { Profile } from "../psn/types";
import { Avatar } from "./ui";

/**
 * Contas da PSN guardadas no celular (além da ativa): tocar troca de conta na
 * hora, sem pedir login; o ✕ tira a conta do celular. `me` é o perfil da conta
 * ativa (null sem conta da PSN ativa, como na tela de entrada).
 */
export function SavedAccountList({ me, onError }: { me: (() => Promise<Profile>) | null; onError: (msg: string) => void }) {
  const accounts = useSavedAccounts();
  const [busy, setBusy] = useState<string | null>(null);
  if (!accounts.length) return null;

  async function open(accountId: string) {
    setBusy(accountId);
    const ok = await switchAccount(accountId, me);
    if (!ok) {
      setBusy(null);
      onError(t("Sem conexão para trocar de conta agora. Tente de novo."));
    }
  }

  return (
    <ul className="divide-y divide-line">
      {accounts.map((a) => (
        <li key={a.accountId} className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => void open(a.accountId)}
            disabled={!!busy}
            className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
          >
            <Avatar src={a.avatarUrl} name={a.onlineId} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{a.onlineId}</span>
              <span className="block text-xs text-muted">
                {busy === a.accountId ? t("Trocando de conta…") : t("Tocar para trocar para esta conta")}
              </span>
            </span>
          </button>
          <button
            aria-label={t("Remover {name} deste celular", { name: a.onlineId })}
            disabled={!!busy}
            onClick={() => {
              if (confirm(t("Remover {name} deste celular? Os dados dessa conta salvos no app são apagados.", { name: a.onlineId }))) {
                forgetSaved(a.accountId);
              }
            }}
            className="rounded-full px-2 py-1 text-muted active:bg-surface-2"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Alternador rápido (Perfil): contas salvas, adicionar outra conta. */
export function AccountSwitcherDialog({
  me,
  onAdd,
  onClose,
}: {
  me: () => Promise<Profile>;
  onAdd: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-[calc(1rem+var(--sab))] pt-4 sm:items-center"
      data-no-pull
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("Trocar de conta")}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="px-4 pt-4 text-lg font-bold">{t("Trocar de conta")}</h2>
        <SavedAccountList me={me} onError={setError} />
        <button
          disabled={adding}
          onClick={() => {
            setAdding(true);
            void onAdd().then((ok) => {
              if (!ok) {
                setAdding(false);
                setError(t("Sem conexão para trocar de conta agora. Tente de novo."));
              }
            });
          }}
          className="w-full border-t border-line px-4 py-3 text-left text-sm font-semibold text-ps-blue-2 active:bg-surface-2 disabled:opacity-60"
        >
          {t("➕ Adicionar outra conta")}
        </button>
        {error && <p className="px-4 pb-3 text-sm text-red-400">{error}</p>}
      </section>
    </div>
  );
}
