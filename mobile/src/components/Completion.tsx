import { t } from "../i18n";
import type { Title } from "../psn/types";

/**
 * Faixas de conclusão de um jogo. Nas listas de jogos usam a cor de destaque
 * do tema (ps-blue-2), mais forte quanto mais perto de 100%; no resumo de
 * conclusão do perfil cada faixa tem a sua própria cor (`color`).
 */
export const COMPLETION_TIERS = [
  { min: 100, label: "100%", name: "Completo", opacity: 1, color: "#22c55e" },
  { min: 75, label: "75–99%", name: "Quase lá", opacity: 0.8, color: "#3b82f6" },
  { min: 50, label: "50–74%", name: "Avançado", opacity: 0.6, color: "#a855f7" },
  { min: 25, label: "25–49%", name: "Em progresso", opacity: 0.42, color: "#f59e0b" },
  { min: 0, label: "0–24%", name: "Começando", opacity: 0.25, color: "#ef4444" },
] as const;

export type CompletionTier = (typeof COMPLETION_TIERS)[number];

export function completionTier(progress: number): CompletionTier {
  return COMPLETION_TIERS.find((t) => progress >= t.min) ?? COMPLETION_TIERS[COMPLETION_TIERS.length - 1];
}

/** Barra ou bolinha na cor do tema, com a intensidade da faixa. */
export function TierFill({ tier, className = "", style }: { tier: CompletionTier; className?: string; style?: React.CSSProperties }) {
  return <span className={`block bg-ps-blue-2 ${className}`} style={{ opacity: tier.opacity, ...style }} />;
}

/** Selo com a porcentagem de conclusão do jogo, nas cores do tema (cheio em 100%). */
export function CompletionBadge({ progress }: { progress: number }) {
  const tier = completionTier(progress);
  const complete = progress >= 100;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${
        complete ? "border-ps-blue bg-ps-blue" : "border-ps-blue-2/40 bg-ps-blue-2/10 text-ps-blue-2"
      }`}
      title={t(tier.name)}
    >
      {complete && <span aria-hidden>✓</span>}
      {progress}%
    </span>
  );
}

/**
 * Resumo de conclusão do perfil: gráfico circular colorido (uma cor por
 * faixa, igual em todos os temas) com quantos jogos há em cada faixa e a
 * média no centro; as legendas ficam empilhadas à direita.
 */
export function CompletionSummary({ titles }: { titles: Title[] }) {
  if (!titles.length) return null;
  const avg = Math.round(titles.reduce((a, t) => a + t.progress, 0) / titles.length);
  const counts = COMPLETION_TIERS.map((tier) => ({ tier, n: titles.filter((t) => completionTier(t.progress) === tier).length }));

  // Rosca: cada faixa é um arco proporcional ao número de jogos.
  const r = 40;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcs = counts
    .filter(({ n }) => n > 0)
    .map(({ tier, n }) => {
      const length = (n / titles.length) * circumference;
      const arc = { tier, length, offset };
      offset += length;
      return arc;
    });

  return (
    <div className="mt-4 flex items-center gap-4 rounded-xl bg-surface-2 p-3">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={t("Conclusão média {n}%", { n: avg })}>
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-surface" />
          {arcs.map(({ tier, length, offset }) => (
            <circle
              key={tier.min}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="12"
              stroke={tier.color}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums">{avg}%</span>
          <span className="text-[0.625rem] uppercase tracking-wide text-muted">{t("média")}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-xs font-semibold text-muted">{t("Conclusão dos jogos")}</p>
        <ul className="space-y-1 text-xs">
          {counts.map(({ tier, n }) => (
            <li key={tier.min} className="flex items-center gap-2">
              <span className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tier.color }} />
              <span className="min-w-0 flex-1 truncate">
                {t(tier.name)} <span className="text-muted">{tier.label}</span>
              </span>
              <span className="font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
