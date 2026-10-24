import { useEffect, useState } from "react";
import { locale, t } from "../i18n";
import { useBackInterceptor } from "../lib/backButton";
import { Avatar, Spinner } from "./ui";

/** Jogador que dá para escolher nas estatísticas ("me" é você). */
export interface PickPlayer {
  accountId: string;
  onlineId: string;
  avatarUrl: string | null;
}

/** Nome mostrado: "Você" para a sua conta. */
const label = (p: PickPlayer) => (p.accountId === "me" ? t("Você") : p.onlineId);

const SEARCH_FROM = 8;

/**
 * Linha "Estatísticas de" / "Comparar com": avatar e nome do escolhido; o
 * toque abre a lista de jogadores (com avatar) em um pop-up.
 */
export function PlayerRow({
  title,
  value,
  options,
  onChange,
  allowNone = false,
  loading = false,
}: {
  title: string;
  /** accountId escolhido ("" = ninguém). */
  value: string;
  options: PickPlayer[];
  onChange: (accountId: string) => void;
  /** Mostra "ninguém" na lista (para a comparação). */
  allowNone?: boolean;
  /** Lista de amigos ainda chegando. */
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((p) => p.accountId === value) ?? null;
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="w-[7.5rem] shrink-0 truncate text-muted">{title}</span>
          {selected ? (
            <Avatar src={selected.avatarUrl} name={selected.onlineId} size={28} />
          ) : (
            <span className="h-7 w-7 shrink-0 rounded-full border border-dashed border-line" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate font-semibold">{selected ? label(selected) : t("ninguém")}</span>
          <span className="text-muted" aria-hidden>
            ▾
          </span>
        </button>
        {allowNone && selected && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("Parar de comparar")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs text-muted"
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <PlayerSheet
          title={title}
          value={value}
          options={options}
          allowNone={allowNone}
          loading={loading}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            setOpen(false);
            onChange(id);
          }}
        />
      )}
    </>
  );
}

/** Lista de jogadores com avatar e busca por nome; fecha no ✕, tocando fora ou no voltar. */
function PlayerSheet({
  title,
  value,
  options,
  allowNone,
  loading,
  onClose,
  onPick,
}: {
  title: string;
  value: string;
  options: PickPlayer[];
  allowNone: boolean;
  loading: boolean;
  onClose: () => void;
  onPick: (accountId: string) => void;
}) {
  useBackInterceptor(true, onClose);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase(locale());
  // Você primeiro; os amigos em ordem alfabética.
  const sorted = [...options].sort((a, b) =>
    a.accountId === "me" ? -1 : b.accountId === "me" ? 1 : a.onlineId.localeCompare(b.onlineId, locale(), { sensitivity: "base" }),
  );
  const list = q ? sorted.filter((p) => label(p).toLocaleLowerCase(locale()).includes(q) || p.onlineId.toLocaleLowerCase(locale()).includes(q)) : sorted;

  const item = (id: string, content: React.ReactNode) => (
    <li key={id || "none"}>
      <button
        type="button"
        onClick={() => onPick(id)}
        aria-current={value === id}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${value === id ? "bg-ps-blue/20" : ""}`}
      >
        {content}
        {value === id && <span className="ml-auto text-ps-blue">✓</span>}
      </button>
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-no-pull>
      <button aria-label={t("Fechar")} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="safe-bottom relative flex max-h-[80dvh] w-full max-w-2xl animate-[sheet-up_200ms_ease-out] flex-col rounded-t-3xl border border-line bg-bg shadow-2xl"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
          <h2 className="min-w-0 flex-1 truncate font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t("Fechar")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-lg text-muted"
          >
            ✕
          </button>
        </div>
        {options.length > SEARCH_FROM && (
          <div className="shrink-0 px-4 pb-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Buscar amigo")}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
            />
          </div>
        )}
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 pb-6">
          {allowNone &&
            !q &&
            item(
              "",
              <>
                <span className="h-9 w-9 shrink-0 rounded-full border border-dashed border-line" aria-hidden />
                <span className="text-sm font-semibold">{t("ninguém")}</span>
              </>,
            )}
          {list.map((p) =>
            item(
              p.accountId,
              <>
                <Avatar src={p.avatarUrl} name={p.onlineId} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{label(p)}</span>
                  {p.accountId === "me" && <span className="block truncate text-xs text-muted">{p.onlineId}</span>}
                </span>
              </>,
            ),
          )}
          {loading && <Spinner label={t("Buscando seus amigos…")} />}
        </ul>
      </section>
    </div>
  );
}
