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

const { getMeritDates, meritDateLabel, recordMeritDates } = await import("../src/lib/meritDates");

describe("data dos méritos", () => {
  beforeEach(() => mem.clear());

  it("na primeira consulta marca como 'até'; depois registra a data exata", () => {
    const d1 = recordMeritDates("acc", ["a", "b"], new Date("2026-10-17T12:00:00Z"));
    expect(d1.a).toEqual({ at: "2026-10-17T12:00:00.000Z", before: true });
    expect(meritDateLabel(d1.a)).toMatch(/^Conquistado até 17\/10\/2026 às \d{2}:\d{2}$/);
    const d2 = recordMeritDates("acc", ["a", "b", "c"], new Date("2026-10-20T12:00:00Z"));
    expect(d2.a.at).toBe("2026-10-17T12:00:00.000Z");
    expect(d2.c).toEqual({ at: "2026-10-20T12:00:00.000Z", before: false });
    expect(meritDateLabel(d2.c)).toMatch(/^Conquistado em 20\/10\/2026 às \d{2}:\d{2}$/);
    expect(getMeritDates("outro")).toEqual({});
  });

  it("jogador sem méritos na primeira vez: os próximos ganham data exata", () => {
    recordMeritDates("novo", [], new Date("2026-10-01T00:00:00Z"));
    expect(recordMeritDates("novo", ["x"], new Date("2026-10-02T00:00:00Z")).x.before).toBe(false);
    mem.set("tm.merits", "[1]");
    expect(getMeritDates("novo")).toEqual({});
  });
});

describe("espaço dos méritos", () => {
  beforeEach(() => mem.clear());

  it("guarda só os jogadores vistos por último, sempre com o atual", () => {
    for (let i = 0; i < 20; i++) recordMeritDates(`amigo${i}`, ["a"]);
    recordMeritDates("eu", ["a"]);
    const book = JSON.parse(mem.get("tm.merits")!);
    expect(Object.keys(book)).toHaveLength(12);
    expect(book.eu).toBeDefined();
    expect(book.amigo19).toBeDefined();
    expect(book.amigo0).toBeUndefined();
  });
});
