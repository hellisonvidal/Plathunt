import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

/** Distância (px, já amortecida) para soltar e atualizar. */
const THRESHOLD = 70;
const MAX_PULL = 110;
/** O dedo anda mais que o indicador: dá a sensação de "esticar". */
const DAMPING = 0.5;

/**
 * Puxar a tela para baixo, a partir do topo, atualiza a página. Só começa
 * quando o gesto é claramente vertical, para não atrapalhar listas que rolam
 * para o lado (filtros, plataformas).
 */
export function usePullToRefresh(onRefresh?: () => void): number {
  const [pull, setPull] = useState(0);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  const enabled = !!onRefresh;

  useEffect(() => {
    if (!enabled) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pulling = false;
    let distance = 0;

    const reset = () => {
      tracking = false;
      pulling = false;
      distance = 0;
      setPull(0);
    };

    const onStart = (e: TouchEvent) => {
      // Dentro de pop-ups (data-no-pull) o gesto rola o pop-up, não atualiza a página.
      const inOverlay = e.target instanceof Element && !!e.target.closest("[data-no-pull]");
      tracking = !inOverlay && e.touches.length === 1 && window.scrollY <= 0;
      pulling = false;
      distance = 0;
      if (tracking) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!pulling) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Gesto para o lado ou para cima: é rolagem, não atualização.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
          tracking = false;
          return;
        }
        pulling = true;
      }
      distance = Math.max(0, Math.min(MAX_PULL, dy * DAMPING));
      setPull(distance);
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (pulling && distance >= THRESHOLD) refresh.current?.();
      reset();
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", reset);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [enabled]);

  return pull;
}

/** Indicador que desce do topo enquanto o usuário puxa (ou gira enquanto atualiza). */
export function PullIndicator({ pull, refreshing }: { pull: number; refreshing?: boolean }) {
  const visible = pull > 0 || refreshing;
  if (!visible) return null;
  const ready = pull >= THRESHOLD;
  const offset = refreshing && pull === 0 ? THRESHOLD * 0.6 : pull;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[var(--sat)] z-30 flex justify-center"
      style={{ transform: `translateY(calc(${offset}px + max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))))` }}
      aria-live="polite"
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-xl shadow-lg ${
          ready || refreshing ? "text-ps-blue-2" : "text-muted"
        }`}
        style={{ opacity: refreshing ? 1 : Math.min(1, pull / THRESHOLD) }}
        aria-label={refreshing ? t("Atualizando") : ready ? t("Solte para atualizar") : t("Puxe para atualizar")}
      >
        <span
          className={refreshing ? "inline-block animate-spin" : "inline-block"}
          style={refreshing ? undefined : { transform: `rotate(${(pull / THRESHOLD) * 270}deg)` }}
        >
          ⟳
        </span>
      </span>
    </div>
  );
}
