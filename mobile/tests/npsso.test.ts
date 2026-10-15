import { describe, expect, it } from "vitest";
import { extractNpsso } from "../src/lib/npsso";

const TOKEN = "a".repeat(32) + "B1".repeat(16);

describe("extractNpsso", () => {
  it("aceita o token puro ou o JSON da Sony", () => {
    expect(extractNpsso(TOKEN)).toBe(TOKEN);
    expect(extractNpsso(` {"npsso":"${TOKEN}"} `)).toBe(TOKEN);
  });
  it("rejeita valores inválidos", () => {
    expect(extractNpsso("")).toBeNull();
    expect(extractNpsso("abc")).toBeNull();
    expect(extractNpsso('{"error":"x"}')).toBeNull();
  });
});
