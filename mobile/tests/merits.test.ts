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
  it("tem 500 méritos, ids únicos e todas as categorias conhecidas", () => {
    expect(MERITS.length).toBe(500);
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
  });
});
