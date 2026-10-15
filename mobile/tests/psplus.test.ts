import { describe, expect, it } from "vitest";
import { describeExpiry } from "../src/lib/psplus";

const NOW = new Date(2026, 9, 15); // 15/10/2026

describe("describeExpiry", () => {
  it("mostra data e dias restantes", () => {
    expect(describeExpiry("2027-03-15", NOW)).toMatchObject({ date: "15/03/2027", daysLeft: 151, state: "ok" });
    expect(describeExpiry("2027-03-15", NOW)?.label).toBe("vence em 15/03/2027 · faltam 151 dias");
  });
  it("avisa quando está perto de vencer, vence hoje ou venceu", () => {
    expect(describeExpiry("2026-10-16", NOW)).toMatchObject({ daysLeft: 1, state: "soon", label: "vence em 16/10/2026 · faltam 1 dia" });
    expect(describeExpiry("2026-10-15", NOW)).toMatchObject({ daysLeft: 0, label: "vence hoje" });
    expect(describeExpiry("2026-09-01", NOW)).toMatchObject({ state: "expired", label: "venceu em 01/09/2026" });
  });
  it("sem data válida, nada", () => {
    expect(describeExpiry("", NOW)).toBeNull();
    expect(describeExpiry("15/03/2027", NOW)).toBeNull();
  });
});
