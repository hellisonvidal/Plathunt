import type { Title } from "../psn/types";

/** Faixas de conclusão de um jogo, do bronze (começando) ao ouro (100%). */
export const COMPLETION_TIERS = [
  { min: 100, label: "100%", name: "Completo", text: "text-gold", bg: "bg-gold", soft: "bg-gold/15 border-gold/50" },
  { min: 75, label: "75–99%", name: "Quase lá", text: "text-platinum", bg: "bg-platinum", soft: "bg-platinum/15 border-platinum/50" },
  { min: 50, label: "50–74%", name: "Avançado", text: "text-ps-blue-2", bg: "bg-ps-blue-2", soft: "bg-ps-blue-2/15 border-ps-blue-2/50" },
  { min: 25, label: "25–49%", name: "Em progresso", text: "text-silver", bg: "bg-silver", soft: "bg-silver/15 border-silver/50" },
  { min: 0, label: "0–24%", name: "Começando", text: "text-bronze", bg: "bg-bronze", soft: "bg-bronze/15 border-bronze/50" },
] as const;

export function completionTier(progress: number) {
  return COMPLETION_TIERS.find((t) => progress >= t.min) ?? COMPLETION_TIERS[COMPLETION_TIERS.length - 1];
}

/** Selo com a porcentagem de conclusão do jogo, na cor da faixa. */
export function CompletionBadge({ progress }: { progress: number }) {
  const tier = completionTier(progress);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${tier.soft} ${tier.text}`}
      title={tier.name}
    >
      {progress >= 100 && <span aria-hidden>✓</span>}
      {progress}%
    </span>
  );
}

/**
 * Resumo de conclusão do perfil: gráfico circular com quantos jogos há em
 * cada faixa e a média no centro; as legendas ficam empilhadas à direita.
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
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Conclusão média ${avg}%`}>
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-surface" />
          {arcs.map(({ tier, length, offset }) => (
            <circle
              key={tier.min}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="12"
              stroke="currentColor"
              className={tier.text}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums">{avg}%</span>
          <span className="text-[0.625rem] uppercase tracking-wide text-muted">média</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-xs font-semibold text-muted">Conclusão dos jogos</p>
        <ul className="space-y-1 text-xs">
          {counts.map(({ tier, n }) => (
            <li key={tier.min} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tier.bg}`} />
              <span className="min-w-0 flex-1 truncate">
                {tier.name} <span className="text-muted">{tier.label}</span>
              </span>
              <span className="font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
