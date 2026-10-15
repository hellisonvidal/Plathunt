import { describe, expect, it } from "vitest";
import { parseEarnedRate, titlesNeedingTrophySync, trophyKey } from "@/lib/sync-plan";

const d = (s: string) => new Date(s);

describe("titlesNeedingTrophySync", () => {
  const remote = [
    { id: "A", lastUpdatedAt: d("2026-01-01") },
    { id: "B", lastUpdatedAt: d("2026-03-01") },
    { id: "C", lastUpdatedAt: d("2026-02-01") },
  ];

  it("inclui jogos nunca sincronizados, mais recentes primeiro", () => {
    expect(titlesNeedingTrophySync(remote, new Map(), 10)).toEqual(["B", "C", "A"]);
  });

  it("ignora jogos sem progresso novo", () => {
    const synced = new Map<string, Date | null>([
      ["A", d("2026-01-01")],
      ["B", d("2026-01-15")],
      ["C", null],
    ]);
    expect(titlesNeedingTrophySync(remote, synced, 10)).toEqual(["B", "C"]);
  });

  it("respeita o limite por execução", () => {
    expect(titlesNeedingTrophySync(remote, new Map(), 1)).toEqual(["B"]);
  });
});

describe("helpers", () => {
  it("trophyKey", () => expect(trophyKey("NPWR1_00", 3)).toBe("NPWR1_00:3"));
  it("parseEarnedRate", () => {
    expect(parseEarnedRate("12.5")).toBe(12.5);
    expect(parseEarnedRate(undefined)).toBeNull();
    expect(parseEarnedRate("x")).toBeNull();
  });
});
