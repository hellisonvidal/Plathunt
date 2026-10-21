import { locale, t } from "../i18n";
import { persistSet } from "./persist";

/**
 * Data em que cada mérito foi conquistado. Os méritos são calculados a partir
 * dos dados da PSN, que não dizem quando um objetivo foi atingido; então o app
 * registra a primeira vez que vê cada mérito liberado. Na primeira vez que os
 * méritos de um jogador são vistos, os que já estavam liberados ficam como
 * "conquistado antes de" essa data.
 */
export interface MeritDate {
  at: string;
  /** Já estava liberado quando o app começou a registrar (data é um limite). */
  before: boolean;
}

type Book = Record<string, Record<string, MeritDate>>;
const KEY = "tm.merits" as const;
/**
 * Jogadores guardados (você e os amigos vistos por último). Com milhares de
 * méritos por jogador, guardar todos os amigos enchia o armazenamento do
 * celular; aí a gravação falhava e os mesmos méritos voltavam a ser avisados.
 */
const MAX_ACCOUNTS = 12;

function read(): Book {
  try {
    const book = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return book && typeof book === "object" && !Array.isArray(book) ? (book as Book) : {};
  } catch {
    return {};
  }
}

export function getMeritDates(accountId: string): Record<string, MeritDate> {
  const dates = read()[accountId];
  return dates && typeof dates === "object" ? dates : {};
}

/** Registra os méritos liberados agora que ainda não tinham data; devolve as datas do jogador. */
export function recordMeritDates(accountId: string, doneIds: string[], now = new Date()): Record<string, MeritDate> {
  const book = read();
  const first = !book[accountId] || typeof book[accountId] !== "object";
  const dates = { ...(first ? {} : book[accountId]) };
  const at = now.toISOString();
  let changed = first;
  for (const id of doneIds) {
    if (dates[id]?.at) continue;
    dates[id] = { at, before: first };
    changed = true;
  }
  if (changed) {
    // O jogador atual vai para o fim; os vistos há mais tempo saem primeiro.
    const { [accountId]: _, ...others } = book;
    const kept = Object.entries(others).slice(-(MAX_ACCOUNTS - 1));
    persistSet(KEY, JSON.stringify({ ...Object.fromEntries(kept), [accountId]: dates }));
  }
  return dates;
}

/** "Conquistado em 18/10/2026 às 21:05" ou "Conquistado até 17/10/2026 às 09:41". */
export function meritDateLabel(d: MeritDate | undefined): string | null {
  if (!d) return null;
  const at = new Date(d.at);
  const date = at.toLocaleDateString(locale());
  const time = at.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  return d.before
    ? t("Conquistado até {date} às {time}", { date, time })
    : t("Conquistado em {date} às {time}", { date, time });
}
