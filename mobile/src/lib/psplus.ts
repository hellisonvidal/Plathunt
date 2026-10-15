/** Planos do PlayStation Plus (informados pelo usuário: a PSN não expõe o plano nem o vencimento). */
export const PS_PLUS_TIERS = {
  essential: "Essential",
  extra: "Extra",
  premium: "Premium",
  deluxe: "Deluxe",
} as const;
export type PsPlusTier = keyof typeof PS_PLUS_TIERS;

export interface ExpiryInfo {
  /** Data formatada (dd/mm/aaaa). */
  date: string;
  /** Dias até o vencimento (negativo se já venceu). */
  daysLeft: number;
  label: string;
  /** "ok" · "soon" (≤ 15 dias) · "expired" */
  state: "ok" | "soon" | "expired";
}

/** "2027-03-15" → texto de vencimento com contagem de dias. */
export function describeExpiry(isoDate: string | null | undefined, now: Date = new Date()): ExpiryInfo | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const expiry = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((expiry - today) / 86_400_000);
  const date = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  if (daysLeft < 0) return { date, daysLeft, label: `venceu em ${date}`, state: "expired" };
  if (daysLeft === 0) return { date, daysLeft, label: "vence hoje", state: "soon" };
  const days = daysLeft === 1 ? "1 dia" : `${daysLeft} dias`;
  return { date, daysLeft, label: `vence em ${date} · faltam ${days}`, state: daysLeft <= 15 ? "soon" : "ok" };
}
