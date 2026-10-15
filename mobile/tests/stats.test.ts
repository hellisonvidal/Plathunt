import { describe, expect, it } from "vitest";
import {
  titlesByPlatform,
  matchPlayed,
  primaryPlatform,
  platformFromCategory,
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
      { titleId: "1", name: "God of War Ragnarök", imageUrl: null, playSeconds: 100, lastPlayed: null, platform: "PS5" },
      { titleId: "2", name: "Marvel’s Spider-Man 2 PS5", imageUrl: null, playSeconds: 200, lastPlayed: null, platform: "PS5" },
    ];
    const m = matchPlaytime(titles, played);
    expect(m.get("A")).toBe(100);
    expect(m.get("B")).toBe(200);
    expect(m.has("C")).toBe(false);
  });
});

describe("matchPlaytime com várias versões do mesmo jogo", () => {
  const ps4 = title("GOW4", "God of War Ragnarök", "PS4", 10, c(0, 0, 1, 3));
  const ps5 = title("GOW5", "God of War Ragnarök", "PS5", 90, c(1, 6, 12, 17));
  const played = (seconds: number, platform: string | null) => ({
    titleId: "x",
    name: "God of War Ragnarök",
    imageUrl: null,
    playSeconds: seconds,
    lastPlayed: null,
    platform,
  });

  it("não repete o tempo nas duas versões: vai para a da mesma plataforma", () => {
    const m = matchPlaytime([ps4, ps5], [played(7200, "PS5")]);
    expect(m.get("GOW5")).toBe(7200);
    expect(m.has("GOW4")).toBe(false);
  });

  it("cada versão recebe o tempo da sua plataforma", () => {
    const m = matchPlaytime([ps4, ps5], [played(7200, "PS5"), played(1800, "PS4")]);
    expect(m.get("GOW5")).toBe(7200);
    expect(m.get("GOW4")).toBe(1800);
  });

  it("sem plataforma conhecida, vai para a versão com mais troféus", () => {
    const m = matchPlaytime([ps4, ps5], [played(600, null)]);
    expect([...m.entries()]).toEqual([["GOW5", 600]]);
  });

  it("o tempo total é a soma dos registros, sem duplicar", () => {
    const m = matchPlaytime([ps4, ps5], [played(7200, "PS5"), played(1800, "PS4")]);
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(9000);
  });
});

describe("plataformas", () => {
  const vitaShared = title("A", "Gravity Rush", "PS4,PSVITA", 50, c(0, 1, 2, 3));
  const ps5 = title("B", "Astro Bot", "PS5", 80, c(1, 2, 3, 4));
  const vitaOnly = title("C", "Tearaway", "PSVITA", 30, c(0, 0, 1, 2));

  it("separa e nomeia as plataformas de uma lista", () => {
    expect(parsePlatforms("PS4,PSVITA")).toEqual(["PS4", "PS Vita"]);
  });

  it("lista multiplataforma conta só na plataforma principal", () => {
    expect(primaryPlatform(vitaShared)).toBe("PS4");
    expect(primaryPlatform(title("D", "d", "PS3,PSVITA", 0, c(0, 0, 0, 0)))).toBe("PS3");
  });

  it("…a não ser que o tempo de jogo diga onde foi jogado", () => {
    expect(primaryPlatform(vitaShared, "PS Vita")).toBe("PS Vita");
    // Plataforma que não está na lista é ignorada.
    expect(primaryPlatform(ps5, "PS4")).toBe("PS5");
  });

  it("PS Vita só aparece quando há jogo que é só de Vita", () => {
    expect(platformsOf([vitaShared, ps5])).toEqual(["PS5", "PS4"]);
    expect(platformsOf([vitaShared, ps5, vitaOnly])).toEqual(["PS5", "PS4", "PS Vita"]);
  });

  it("filtra cada jogo pela plataforma em que conta", () => {
    const ts = [vitaShared, ps5, vitaOnly];
    expect(filterByPlatform(ts, "PS Vita").map((t) => t.id)).toEqual(["C"]);
    expect(filterByPlatform(ts, "PS4").map((t) => t.id)).toEqual(["A"]);
    expect(filterByPlatform(ts, "PS Vita", new Map([["A", "PS Vita"]])).map((t) => t.id)).toEqual(["A", "C"]);
    expect(filterByPlatform(ts, null)).toHaveLength(3);
  });

  it("jogos por plataforma não contam o mesmo jogo duas vezes", () => {
    const s = computeStats([vitaShared, ps5], new Map());
    expect(s.byPlatform).toEqual([
      { platform: "PS5", games: 1 },
      { platform: "PS4", games: 1 },
    ]);
  });
});

describe("titlesByPlatform", () => {
  it("agrupa por plataforma em ordem alfabética, cada jogo uma vez", () => {
    const ts = [
      title("1", "Uncharted 4", "PS4", 10, c(0, 0, 0, 1)),
      title("2", "astro Bot", "PS5", 10, c(0, 0, 0, 1)),
      title("3", "Bloodborne", "PS4,PSVITA", 10, c(0, 0, 0, 1)),
      title("4", "Ápex", "PS4", 10, c(0, 0, 0, 1)),
    ];
    const g = titlesByPlatform(ts);
    expect([...g.keys()]).toEqual(["PS5", "PS4"]);
    expect(g.get("PS4")!.map((t) => t.name)).toEqual(["Ápex", "Bloodborne", "Uncharted 4"]);
  });
});

describe("matchPlayed", () => {
  it("guarda a plataforma do registro com mais tempo", () => {
    const g = title("G", "Gravity Rush", "PS4,PSVITA", 50, c(0, 1, 2, 3));
    const played = [
      { titleId: "1", name: "Gravity Rush", imageUrl: null, playSeconds: 3600, lastPlayed: null, platform: "PS4" },
      { titleId: "2", name: "Gravity Rush", imageUrl: null, playSeconds: 600, lastPlayed: null, platform: "PS5" },
    ];
    expect(matchPlayed([g], played).get("G")).toEqual({ seconds: 4200, platform: "PS4" });
  });
});

describe("platformFromCategory", () => {
  it("lê a plataforma da categoria da PSN", () => {
    expect(platformFromCategory("ps5_native_game")).toBe("PS5");
    expect(platformFromCategory("ps4_game")).toBe("PS4");
    expect(platformFromCategory("unknown")).toBeNull();
    expect(platformFromCategory(undefined)).toBeNull();
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
