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

describe("catálogo do boost", async () => {
  const { buildBoostCatalog, searchBoostCatalog } = await import("../src/lib/boost");
  const t = (id: string, name: string, progress = 10) =>
    ({ id, name, service: "trophy2", iconUrl: null, platform: "PS5", progress, earned: { platinum: 0, gold: 0, silver: 0, bronze: 0 },
      defined: { platinum: 1, gold: 0, silver: 0, bronze: 0 }, lastUpdated: "2026-01-01T00:00:00Z", hasGroups: false }) as const;

  it("junta seus jogos, os dos amigos e a loja, sem repetir", () => {
    const catalog = buildBoostCatalog(
      [t("A", "Astro Bot", 50)],
      [[t("B", "Helldivers 2"), t("A2", "Astro Bot™")], [t("B", "Helldivers 2")]],
      [{ name: "Helldivers 2", platforms: ["PS5"], imageUrl: "h.png" }, { name: "Gran Turismo 7", platforms: ["PS5", "PS4"], imageUrl: null }],
    );
    expect(catalog).toHaveLength(3);
    const hd = catalog.find((c) => c.name === "Helldivers 2")!;
    expect([hd.friends, hd.inStore, hd.title?.id, hd.iconUrl]).toEqual([2, true, "B", "h.png"]);
    const astro = catalog.find((c) => c.key === "astro bot")!;
    expect([astro.myProgress, astro.friends]).toEqual([50, 1]);
    expect(catalog.find((c) => c.name === "Gran Turismo 7")!.title).toBeNull();
    expect(searchBoostCatalog(catalog, "gran").map((c) => c.name)).toEqual(["Gran Turismo 7"]);
    expect(searchBoostCatalog(catalog, "")).toEqual([]);
  });
});
