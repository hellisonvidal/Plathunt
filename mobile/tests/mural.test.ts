import { describe, expect, it } from "vitest";
import { muralTiles, type MuralPlayer } from "../src/components/Mural";
import type { Counts, Title } from "../src/psn/types";

const c = (platinum: number, gold: number, silver: number, bronze: number): Counts => ({ platinum, gold, silver, bronze });
const title = (id: string, platform: string, progress: number, earned: Counts, day: number): Title => ({
  id, service: "trophy2", name: id, iconUrl: null, platform, progress, earned, defined: earned,
  lastUpdated: new Date(Date.UTC(2026, 0, day)).toISOString(), hasGroups: false,
});
const player: MuralPlayer = {
  name: "me",
  accountId: "me",
  titles: [
    title("A", "PS5", 100, c(1, 3, 5, 10), 3),
    title("B", "PS4", 40, c(0, 1, 2, 30), 5),
    title("C", "PS5", 0, c(0, 0, 0, 0), 9),
  ],
  playtime: new Map([["B", 7200]]),
  playedOn: new Map(),
};
const ids = (cat: Parameters<typeof muralTiles>[0], platform: string | null = null) =>
  muralTiles(cat, player, platform).map((t) => t.title.id);

describe("muralTiles", () => {
  it("monta cada categoria só com jogos com troféus, na ordem certa", () => {
    expect(ids("jogos")).toEqual(["B", "A"]);
    expect(ids("platinas")).toEqual(["A"]);
    expect(ids("completos")).toEqual(["A"]);
    expect(ids("conclusao")).toEqual(["A", "B"]);
    expect(ids("trofeus")).toEqual(["B", "A"]);
    expect(ids("tempo")).toEqual(["B"]);
    expect(muralTiles("tempo", player, null)[0].metric).toBe("2 h");
  });
  it("respeita o filtro de plataforma", () => {
    expect(ids("jogos", "PS5")).toEqual(["A"]);
  });
});

describe("mural de um ano", () => {
  it("mostra os jogos que começaram naquele ano", () => {
    const withFirst = { ...player, firstPlayed: new Map([["B", "2023-05-01T00:00:00Z"]]) };
    expect(muralTiles({ year: 2026 }, withFirst, null).map((t) => t.title.id)).toEqual(["A"]);
    expect(muralTiles({ year: 2023 }, withFirst, null).map((t) => [t.title.id, t.metric])).toEqual([["B", "40%"]]);
  });
});
