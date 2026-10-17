import { beforeEach, describe, expect, it } from "vitest";

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { addBoost, boostMessage, getBoosts, removeBoost, sameGame, updateBoost } = await import("../src/lib/boost");

const game = { id: "NPWR1", name: "Astro Bot", platform: "PS5", iconUrl: null };

describe("convocação de boost", () => {
  beforeEach(() => mem.clear());

  it("monta o texto com jogo, vagas, horário e troféus", () => {
    const text = boostMessage({ game, players: 2, when: "Hoje à noite", trophies: ["Online 1", "Online 2"], note: " mic " }, "Kratos_BR");
    expect(text).toContain("BOOST: Astro Bot (PS5)");
    expect(text).toContain("Procuro 2 jogadores · 🕒 Hoje à noite");
    expect(text).toContain("Troféus: Online 1, Online 2");
    expect(text).toContain("📝 mic");
    expect(text).toContain("PSN: Kratos_BR");
  });

  it("salva, marca quem topou, conclui e apaga", () => {
    const b = addBoost({ game, players: 1, when: "Agora", trophies: [], note: "" });
    updateBoost(b.id, { joined: ["Aloy"], done: true });
    expect(getBoosts()[0]).toMatchObject({ joined: ["Aloy"], done: true });
    removeBoost(b.id);
    expect(getBoosts()).toEqual([]);
    mem.set("tm.boosts", '{"x":1}');
    expect(getBoosts()).toEqual([]);
  });

  it("reconhece o mesmo jogo em PS4 e PS5", () => {
    expect(sameGame({ id: "A", name: "God of War Ragnarök PS4" }, { id: "B", name: "God of War Ragnarök™" })).toBe(true);
    expect(sameGame({ id: "A", name: "Bloodborne" }, { id: "B", name: "Returnal" })).toBe(false);
  });
});
