import { describe, expect, it } from "vitest";
import { INITIAL_REVEAL, nextReveal, type RevealState } from "../src/lib/scrollReveal";

/** Simula gestos: cada um desce `step` px em 3 eventos, com pausa de 400 ms entre gestos. */
function swipeDown(s: RevealState, gestures: number, t0: number): [RevealState, number] {
  let t = t0;
  for (let g = 0; g < gestures; g++) {
    t += 400;
    for (let i = 0; i < 3; i++) {
      t += 16;
      s = nextReveal(s, s.y + 200, t);
    }
  }
  return [s, t];
}

describe("filtros que voltam ao rolar para cima", () => {
  it("com 4 gestos para baixo, subir não mostra a barra", () => {
    let [s, t] = swipeDown({ ...INITIAL_REVEAL, y: 300 }, 4, 0);
    s = nextReveal(s, s.y - 60, t + 400);
    expect(s.revealed).toBe(false);
  });

  it("com mais de 4 gestos, subir mostra a barra e descer esconde", () => {
    let [s, t] = swipeDown({ ...INITIAL_REVEAL, y: 300 }, 5, 0);
    s = nextReveal(s, s.y - 60, (t += 400));
    expect(s.revealed).toBe(true);
    s = nextReveal(s, s.y + 100, (t += 16));
    expect(s.revealed).toBe(false);
  });

  it("perto do topo recomeça a contagem", () => {
    let [s, t] = swipeDown({ ...INITIAL_REVEAL, y: 300 }, 6, 0);
    s = nextReveal(s, 100, (t += 400));
    expect(s).toMatchObject({ gestures: 0, revealed: false });
  });
});
