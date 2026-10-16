/**
 * Gráficos simples em HTML para as estatísticas. Cores validadas contra o fundo
 * escuro (protan/deutan/tritan e contraste): azul = você, laranja = amigo.
 */
export const SERIES_COLORS = ["#2f8cff", "#d07a25"] as const;

export interface Series {
  name: string;
  values: number[];
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted">
      {series.map((s, i) => (
        <span key={s.name} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

/**
 * Barras horizontais agrupadas: uma linha por categoria, uma barra por série.
 * Cada barra leva o valor escrito ao lado (rótulo direto), então a cor nunca
 * é a única pista.
 */
export function GroupedBars({
  categories,
  series,
  format = (v) => v.toLocaleString("pt-BR"),
  colorOffset = 0,
}: {
  categories: React.ReactNode[];
  series: Series[];
  format?: (v: number) => string;
  /** Para uma série sozinha que não é a primeira (ex.: só o amigo), mantém a cor dela. */
  colorOffset?: number;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div className="space-y-3">
      {categories.map((label, ci) => (
        <div key={ci} className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
          <div className="text-sm">{label}</div>
          <div className="space-y-[0.125rem]">
            {series.map((s, si) => {
              const v = s.values[ci] ?? 0;
              return (
                <div key={s.name} className="flex items-center gap-2" title={`${s.name}: ${format(v)}`}>
                  <div className="h-2.5 flex-1">
                    <div
                      className="h-full rounded-r-[0.25rem]"
                      style={{ width: `${(v / max) * 100}%`, minWidth: v > 0 ? 3 : 0, background: SERIES_COLORS[si + colorOffset] }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">{format(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Número de destaque; com dois valores, mostra você vs. amigo lado a lado. */
export function StatTile({
  label,
  values,
  names,
  selected,
  onSelect,
}: {
  label: string;
  values: string[];
  names: string[];
  /** Com `onSelect`, o quadro vira um botão (ex.: abre o mural da categoria). */
  selected?: boolean;
  onSelect?: () => void;
}) {
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      {...(onSelect ? { onClick: onSelect, "aria-pressed": !!selected, type: "button" as const } : {})}
      className={`rounded-2xl border bg-surface p-3 text-left ${
        selected ? "border-ps-blue-2 ring-1 ring-ps-blue-2" : "border-line"
      } ${onSelect ? "active:bg-surface-2" : ""}`}
    >
      <p className="flex items-center justify-between gap-1 text-xs text-muted">
        {label}
        {onSelect && <span aria-hidden>{selected ? "▾" : "▸"}</span>}
      </p>
      {values.length === 1 ? (
        <p className="mt-1 text-2xl font-bold tabular-nums">{values[0]}</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          {values.map((v, i) => (
            <p key={names[i]} className="flex items-center gap-1.5 text-lg font-bold tabular-nums">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SERIES_COLORS[i] }} />
              {v}
            </p>
          ))}
        </div>
      )}
    </Tag>
  );
}
