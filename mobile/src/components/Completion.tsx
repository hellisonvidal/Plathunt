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
 * Resumo de conclusão do perfil: média, jogos 100% e uma barra com quantos
 * jogos há em cada faixa.
 */
export function CompletionSummary({ titles }: { titles: Title[] }) {
  if (!titles.length) return null;
  const avg = Math.round(titles.reduce((a, t) => a + t.progress, 0) / titles.length);
  const counts = COMPLETION_TIERS.map((tier) => ({ tier, n: titles.filter((t) => completionTier(t.progress) === tier).length }));
  return (
    <div className="mt-4 rounded-xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">Conclusão dos jogos</span>
        <span className="flex items-center gap-2">
          <CompletionBadge progress={avg} />
          <span className="text-xs text-muted">média</span>
        </span>
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface" role="img" aria-label="Jogos por faixa de conclusão">
        {counts.map(({ tier, n }) =>
          n ? <span key={tier.min} className={tier.bg} style={{ width: `${(n / titles.length) * 100}%` }} /> : null,
        )}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.6875rem] text-muted">
        {counts.map(({ tier, n }) => (
          <li key={tier.min} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${tier.bg}`} />
            <span className="flex-1">
              {tier.name} <span className="opacity-70">({tier.label})</span>
            </span>
            <span className="font-semibold tabular-nums text-ink">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
