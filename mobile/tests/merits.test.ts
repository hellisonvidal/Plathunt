import { describe, expect, it } from "vitest";
import { evaluateMerits, MERIT_CATEGORIES, MERITS } from "../src/lib/merits";
import type { Counts, Profile, Title } from "../src/psn/types";

const NOW = new Date("2026-10-16T12:00:00Z").getTime();
const c = (platinum: number, gold: number, silver: number, bronze: number): Counts => ({ platinum, gold, silver, bronze });
const title = (id: string, platform: string, progress: number, earned: Counts, daysAgo = 1): Title => ({
  id, service: "trophy2", name: id, iconUrl: null, platform, progress, earned, defined: earned,
  lastUpdated: new Date(NOW - daysAgo * 86_400_000).toISOString(), hasGroups: false,
});
const profile: Profile = {
  accountId: "me", onlineId: "me", avatarUrl: null, aboutMe: null, isPlus: true, level: 120, levelProgress: 0, earned: c(12, 60, 200, 900),
};

describe("méritos", () => {
  it("tem 2.000 méritos, ids únicos e todas as categorias conhecidas", () => {
    expect(MERITS.length).toBe(2000);
    expect(MERITS.filter((m) => m.category === "desafios")).toHaveLength(60);
    expect(new Set(MERITS.map((m) => m.id)).size).toBe(MERITS.length);
    const cats = new Set(MERIT_CATEGORIES.map((c) => c.id));
    expect(MERITS.every((m) => cats.has(m.category))).toBe(true);
  });

  it("libera os méritos conforme os objetivos", () => {
    const titles = [
      title("A", "PS5", 100, c(1, 12, 5, 20)),
      title("B", "PS4", 95, c(0, 2, 3, 10), 400),
      title("C", "PS4,PSVITA", 40, c(0, 0, 1, 4), 2000),
    ];
    const results = evaluateMerits({
      profile, titles, playtime: new Map([["A", 120 * 3600]]), playedOn: new Map(), friends: 30, reactions: 2, now: NOW,
    });
    const done = (id: string) => results.find((r) => r.merit.id === id)?.done;
    expect(done("platinas-10")).toBe(true);
    expect(done("platinas-25")).toBe(false);
    expect(done("nivel-100")).toBe(true);
    expect(done("ps5-jogos-1")).toBe(true);
    expect(done("vita-jogos-1")).toBe(false); // lista PS4,PSVITA conta como PS4
    expect(done("tempo-jogo-100")).toBe(true);
    expect(done("conclusao-quase-1")).toBe(true);
    expect(done("curioso-ouro-jogo-10")).toBe(true);
    expect(done("veterano-5")).toBe(true);
    expect(done("social-25")).toBe(true);
    expect(done("curtidas-10")).toBe(false);
    expect(done("ps4-platinas-1")).toBe(false);
    expect(done("ps5-platinas-1")).toBe(true);
    expect(done("temporada-2026")).toBe(true);
    expect(done("temporada-platina-2026")).toBe(true);
    expect(done("tempo-10h-1")).toBe(true);
    const partial = results.find((r) => r.merit.id === "platinas-25")!;
    expect(partial.ratio).toBeCloseTo(12 / 25);
  });

  it("méritos sem dado (amigos e curtidas de outro jogador) ficam de fora", () => {
    const results = evaluateMerits({ profile, titles: [], playtime: new Map(), playedOn: new Map(), friends: null, reactions: null, now: NOW });
    expect(results.some((r) => r.merit.category === "social")).toBe(false);
    expect(results.some((r) => r.merit.category === "desafios")).toBe(false);
  });
});

describe("traduções dos méritos", () => {
  it("nomes, descrições, categorias e gêneros têm tradução em todos os idiomas", async () => {
    const { dictionary, LANGUAGES } = await import("../src/i18n");
    const { GENRES } = await import("../src/lib/genres");
    const texts = new Set([
      ...MERITS.flatMap((m) => [m.name, m.description]),
      ...MERIT_CATEGORIES.map((c) => c.label),
      ...GENRES.map((g) => g.label),
      "Madrugada",
      "Manhã",
      "Tarde",
      "Noite",
    ]);
    for (const lang of LANGUAGES.map((l) => l.value).filter((l) => l !== "pt-BR")) {
      const dict = dictionary(lang);
      expect([...texts].filter((k) => !(k in dict))).toEqual([]);
    }
  });
});

describe("data dos méritos e gêneros", () => {
  it("a data é a da última conquista do jogo que liberou o mérito", () => {
    const titles = [
      { ...title("God of War Ragnarök", "PS5", 100, c(1, 5, 10, 20), 30), id: "gow" },
      { ...title("Gran Turismo 7", "PS5", 60, c(0, 2, 5, 30), 10), id: "gt7" },
      { ...title("Bloodborne", "PS4", 100, c(1, 6, 15, 12), 5), id: "bb" },
    ];
    const results = evaluateMerits({ profile, titles, playtime: new Map(), playedOn: new Map(), friends: null, reactions: null, now: NOW });
    const at = (id: string) => results.find((r) => r.merit.id === id)?.at;
    // 1ª platina: God of War (30 dias atrás); 2ª: Bloodborne (5 dias atrás).
    expect(at("platinas-1")).toBe(NOW - 30 * 86_400_000);
    expect(at("platinas-2")).toBe(NOW - 5 * 86_400_000);
    // Méritos de gênero, pelo nome do jogo.
    const done = (id: string) => results.find((r) => r.merit.id === id)?.done;
    expect(done("genero-acao-jogos-1")).toBe(true);
    expect(done("genero-corrida-jogos-1")).toBe(true);
    expect(done("genero-soulslike-platinas-1")).toBe(true);
    expect(at("genero-corrida-jogos-1")).toBe(NOW - 10 * 86_400_000);
    // Nível não tem troféu de origem: fica com a data registrada pelo app.
    expect(at("nivel-100")).toBeNull();
  });

  it("reconhece gêneros pelo nome do jogo", async () => {
    const { genresOf } = await import("../src/lib/genres");
    expect(genresOf("Marvel's Spider-Man 2")).toContain("acao");
    expect(genresOf("ELDEN RING™")).toEqual(expect.arrayContaining(["soulslike", "mundoAberto"]));
    expect(genresOf("EA SPORTS FC™ 25")).toContain("esportes");
    expect(genresOf("Jogo Desconhecido")).toEqual([]);
  });
});
