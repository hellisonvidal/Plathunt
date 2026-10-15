const TROPHY_STYLES: Record<string, { label: string; color: string }> = {
  platinum: { label: "Platina", color: "text-platinum" },
  gold: { label: "Ouro", color: "text-gold" },
  silver: { label: "Prata", color: "text-silver" },
  bronze: { label: "Bronze", color: "text-bronze" },
};

export function TrophyBadge({ type, count }: { type: string; count?: number }) {
  const s = TROPHY_STYLES[type] ?? TROPHY_STYLES.bronze;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${s.color}`} title={s.label}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z" />
      </svg>
      {count !== undefined ? count : s.label}
    </span>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (!src) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-muted"
        style={{ width: size, height: size }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full bg-surface-2" />;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full bg-ps-blue-2" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function rarityLabel(rate: number | null): string | null {
  if (rate === null) return null;
  if (rate <= 5) return `Ultra raro · ${rate.toFixed(1)}%`;
  if (rate <= 15) return `Muito raro · ${rate.toFixed(1)}%`;
  if (rate <= 50) return `Raro · ${rate.toFixed(1)}%`;
  return `Comum · ${rate.toFixed(1)}%`;
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 30) return `há ${Math.floor(diff / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
