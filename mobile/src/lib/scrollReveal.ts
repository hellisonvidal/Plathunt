import { useEffect, useState } from "react";

/**
 * Barra que volta ao rolar para cima: depois de mais de `MIN_GESTURES` gestos
 * de rolar para baixo, o primeiro movimento para cima traz os filtros de
 * volta ao topo da tela; rolar para baixo de novo esconde.
 */
export const MIN_GESTURES = 5;
/** Pausa entre eventos de rolagem que separa um gesto do outro. */
const GESTURE_GAP_MS = 250;
/** Perto do topo a barra já está à vista: a contagem recomeça. */
const TOP_PX = 240;
const UP_PX = 24;
const DOWN_PX = 48;

export interface RevealState {
  y: number;
  t: number;
  goingDown: boolean;
  gestures: number;
  up: number;
  down: number;
  revealed: boolean;
}

export const INITIAL_REVEAL: RevealState = { y: 0, t: 0, goingDown: false, gestures: 0, up: 0, down: 0, revealed: false };

/** Próximo estado a partir da posição da rolagem (`y`) e do horário (`t`, ms). */
export function nextReveal(s: RevealState, y: number, t: number): RevealState {
  if (y < TOP_PX) return { ...INITIAL_REVEAL, y, t };
  const dy = y - s.y;
  if (dy === 0) return { ...s, t };
  if (dy > 0) {
    // Novo gesto: começou a descer agora ou depois de uma pausa.
    const fresh = !s.goingDown || t - s.t > GESTURE_GAP_MS;
    const down = s.down + dy;
    return {
      y,
      t,
      goingDown: true,
      gestures: s.gestures + (fresh ? 1 : 0),
      up: 0,
      down,
      revealed: s.revealed && down < DOWN_PX,
    };
  }
  const up = s.up - dy;
  return { ...s, y, t, goingDown: false, up, down: 0, revealed: s.revealed || (s.gestures >= MIN_GESTURES && up >= UP_PX) };
}

/** `true` enquanto a barra deve aparecer presa no topo da tela. */
export function useRevealOnScrollUp(): boolean {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    let state: RevealState = { ...INITIAL_REVEAL, y: window.scrollY };
    const onScroll = () => {
      state = nextReveal(state, window.scrollY, performance.now());
      setRevealed(state.revealed);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return revealed;
}
