import { describe, expect, it } from "vitest";
import {
  computeStats,
  filterByPlatform,
  withEarnedTrophies,
  formatDuration,
  groupTrophies,
  matchPlaytime,
  parseDuration,
  parsePlatforms,
  platformsOf,
} from "../src/lib/stats";
import type { Counts, Title, TrophyRow } from "../src/psn/types";

const c = (platinum: number, gold: number, silver: number, bronze: number): Counts => ({ platinum, gold, silver, bronze });
function title(id: string, name: string, platform: string, progress: number, earned: Counts): Title {
  return { id, service: "trophy2", name, iconUrl: null, platform, progress, earned, defined: earned, lastUpdated: "", hasGroups: false };
}
function trophy(id: number, groupId: string, earned: boolean): TrophyRow {
  return { id, type: "bronze", name: `T${id}`, detail: null, iconUrl: null, hidden: false, groupId, earned, earnedAt: null, rate: null };
}

describe("duração", () => {
  it("lê o formato ISO da PSN", () => {
    expect(parseDuration("PT228H56M33S")).toBe(228 * 3600 + 56 * 60 + 33);
    expect(parseDuration("PT45M")).toBe(2700);
    expect(parseDuration("P1DT2H")).toBe(26 * 3600);
    expect(parseDuration("lixo")).toBe(0);
    expect(parseDuration(undefined)).toBe(0);
  });
  it("formata para leitura", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(2700)).toBe("45 min");
    expect(formatDuration(3 * 3600)).toBe("3 h");
    expect(formatDuration(3 * 3600 + 120)).toBe("3 h 2 min");
    expect(formatDuration(228 * 3600 + 3000)).toBe("228 h");
  });
});

describe("matchPlaytime", () => {
  it("casa pelo nome normalizado, ignorando símbolos, acentos e sufixos de plataforma", () => {
    const titles = [
      title("A", "God of War Ragnarök", "PS5", 100, c(1, 0, 0, 0)),
      title("B", "Marvel's Spider-Man 2", "PS5", 50, c(0, 0, 0, 0)),
      title("C", "Uncharted 2: Among Thieves™", "PS3", 100, c(1, 0, 0, 0)),
    ];
    const played = [
      { titleId: "1", name: "God of War Ragnarök", imageUrl: null, playSeconds: 100, lastPlayed: null },
      { titleId: "2", name: "Marvel’s Spider-Man 2 PS5", imageUrl: null, playSeconds: 200, lastPlayed: null },
    ];
    const m = matchPlaytime(titles, played);
    expect(m.get("A")).toBe(100);
    expect(m.get("B")).toBe(200);
    expect(m.has("C")).toBe(false);
  });
});

describe("plataformas", () => {
  it("separa e nomeia plataformas", () => {
    expect(parsePlatforms("PS4,PSVITA")).toEqual(["PS4", "PS Vita"]);
    expect(platformsOf([title("A", "a", "PS3", 0, c(0, 0, 0, 0)), title("B", "b", "PS5,PS4", 0, c(0, 0, 0, 0))])).toEqual([
      "PS5",
      "PS4",
      "PS3",
    ]);
  });
  it("filtra jogos multiplataforma por qualquer uma delas", () => {
    const ts = [title("A", "a", "PS4,PSVITA", 0, c(0, 0, 0, 0)), title("B", "b", "PS5", 0, c(0, 0, 0, 0))];
    expect(filterByPlatform(ts, "PS Vita").map((t) => t.id)).toEqual(["A"]);
    expect(filterByPlatform(ts, null)).toHaveLength(2);
  });
});

describe("withEarnedTrophies", () => {
  it("descarta jogos sem nenhum troféu conquistado", () => {
    const ts = [title("A", "a", "PS5", 0, c(0, 0, 0, 0)), title("B", "b", "PS4", 3, c(0, 0, 0, 1))];
    expect(withEarnedTrophies(ts).map((t) => t.id)).toEqual(["B"]);
  });
});

describe("computeStats", () => {
  it("soma troféus, platinas, conclusão e tempo", () => {
    const ts = [
      title("A", "a", "PS5", 100, c(1, 2, 3, 4)),
      title("B", "b", "PS4", 50, c(0, 1, 1, 1)),
    ];
    const s = computeStats(ts, new Map([["A", 7200]]));
    expect(s).toMatchObject({ games: 2, completed: 1, platinums: 1, avgProgress: 75, totalTrophies: 13, playSeconds: 7200, gamesWithPlaytime: 1 });
    expect(s.byPlatform).toEqual([
      { platform: "PS5", games: 1 },
      { platform: "PS4", games: 1 },
    ]);
    expect(s.topPlayed.map((t) => t.title.id)).toEqual(["A"]);
  });
});

describe("groupTrophies", () => {
  it("separa jogo base e DLCs e conta os conquistados", () => {
    const groups = [
      { id: "default", name: "God of War", iconUrl: null, defined: c(1, 0, 0, 1) },
      { id: "001", name: "Valhalla", iconUrl: null, defined: c(0, 0, 0, 1) },
    ];
    const sections = groupTrophies([trophy(0, "default", true), trophy(1, "default", false), trophy(2, "001", true)], groups);
    expect(sections.map((s) => [s.group.id, s.isBase, s.trophies.length, s.earned])).toEqual([
      ["default", true, 2, 1],
      ["001", false, 1, 1],
    ]);
  });
  it("sem grupos da PSN, tudo vai para o jogo base", () => {
    const sections = groupTrophies([trophy(0, "default", false), trophy(1, "002", true)], []);
    expect(sections).toHaveLength(1);
    expect(sections[0].earned).toBe(1);
  });
});
