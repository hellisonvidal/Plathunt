import { describe, expect, it } from "vitest";
import { extractNpsso } from "@/lib/npsso";

const TOKEN = "a".repeat(32) + "B1".repeat(16);

describe("extractNpsso", () => {
  it("aceita o token puro", () => {
    expect(extractNpsso(TOKEN)).toBe(TOKEN);
  });
  it("aceita o JSON inteiro copiado da Sony", () => {
    expect(extractNpsso(`{"npsso":"${TOKEN}"}`)).toBe(TOKEN);
    expect(extractNpsso(`  { "npsso" : "${TOKEN}" }\n`)).toBe(TOKEN);
  });
  it("aceita token entre aspas", () => {
    expect(extractNpsso(`"${TOKEN}"`)).toBe(TOKEN);
  });
  it("rejeita valores inválidos", () => {
    expect(extractNpsso("")).toBeNull();
    expect(extractNpsso("abc")).toBeNull();
    expect(extractNpsso(TOKEN + "x")).toBeNull();
    expect(extractNpsso('{"error":"invalid"}')).toBeNull();
  });
});
