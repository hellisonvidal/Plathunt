import { useState } from "react";
import { imageCandidates } from "../lib/images";
import { locale, t } from "../i18n";

const TROPHY_STYLES: Record<string, { label: string; color: string }> = {
  platinum: { label: "Platina", color: "text-platinum" },
  gold: { label: "Ouro", color: "text-gold" },
  silver: { label: "Prata", color: "text-silver" },
  bronze: { label: "Bronze", color: "text-bronze" },
};

const TROPHY_PATH =
  "M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z";

export function TrophyBadge({ type, count }: { type: string; count?: number }) {
  const s = TROPHY_STYLES[type] ?? TROPHY_STYLES.bronze;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${s.color}`} title={t(s.label)}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d={TROPHY_PATH} />
      </svg>
      {count !== undefined ? count : t(s.label)}
    </span>
  );
}

/** Os quatro troféus juntos (platina, ouro, prata e bronze): ícone de "todos os troféus". */
export function TrophyStack() {
  return (
    <span className="flex -space-x-[0.4em]" aria-hidden>
      {(["platinum", "gold", "silver", "bronze"] as const).map((type) => (
        <svg key={type} viewBox="0 0 24 24" className={`h-4 w-4 fill-current ${TROPHY_STYLES[type].color}`}>
          <path d={TROPHY_PATH} />
        </svg>
      ))}
    </span>
  );
}

/**
 * Imagem remota da PSN com tentativas: https primeiro, depois o endereço
 * original; se nada carregar, mostra `fallback`.
 */
export function RemoteImage({
  src,
  fallback,
  fit,
  ...props
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  fallback: React.ReactNode;
  /** Largura na tela (px): imagens da loja vêm nesse tamanho, não em alta resolução. */
  fit?: number;
}) {
  const candidates = imageCandidates(src, fit ?? (typeof props.width === "number" ? props.width : undefined));
  const [attempt, setAttempt] = useState(0);
  const [lastSrc, setLastSrc] = useState(src);
  // Recomeça as tentativas quando o endereço muda (ex.: dados atualizados).
  if (lastSrc !== src) {
    setLastSrc(src);
    setAttempt(0);
  }
  if (attempt >= candidates.length) return <>{fallback}</>;
  return (
    <img
      {...props}
      src={candidates[attempt]}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}

/** Tamanhos em rem: acompanham a escala da tela (styles.css). `px` é o tamanho em uma tela de referência. */
const rem = (px: number) => `${px / 16}rem`;

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const initial = (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-muted"
      style={{ width: rem(size), height: rem(size) }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
  return (
    <RemoteImage
      src={src}
      fallback={initial}
      alt={name}
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-surface-2 object-cover"
      style={{ width: rem(size), height: rem(size) }}
    />
  );
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
  const pct = rate.toFixed(1);
  if (rate <= 5) return t("Ultra raro · {pct}%", { pct });
  if (rate <= 15) return t("Muito raro · {pct}%", { pct });
  if (rate <= 50) return t("Raro · {pct}%", { pct });
  return t("Comum · {pct}%", { pct });
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t("agora");
  if (diff < 3600) return t("há {n} min", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("há {n} h", { n: Math.floor(diff / 3600) });
  if (diff < 86400 * 30) return t("há {n} d", { n: Math.floor(diff / 86400) });
  return new Date(iso).toLocaleDateString(locale());
}

const LOADING = "Carregando…";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ps-blue-2" />
      {label ?? t(LOADING)}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : t("Algo deu errado.");
  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
      <p>{t("Não foi possível falar com a PSN agora.")}</p>
      <p className="mt-1 text-xs text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-full bg-surface-2 px-4 py-1.5">
          {t("Tentar de novo")}
        </button>
      )}
    </div>
  );
}

export function GameIcon({ src, size = 56 }: { src: string | null; size?: number }) {
  const placeholder = (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xl"
      style={{ width: rem(size), height: rem(size) }}
    >
      🎮
    </span>
  );
  return (
    <RemoteImage
      src={src}
      fallback={placeholder}
      alt=""
      fit={size}
      className="shrink-0 rounded-lg object-cover"
      style={{ width: rem(size), height: rem(size) }}
    />
  );
}
