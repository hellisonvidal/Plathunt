import { describe, expect, it } from "vitest";

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

describe("configurações salvas", () => {
  it("descarta valores com tipo errado e mantém os válidos", async () => {
    const { getSettings, DEFAULT_SETTINGS } = await import("../src/lib/settings");
    mem.set("tm.settings", JSON.stringify({ feedDays: { quebrado: true }, theme: "oled", revealSecrets: "sim" }));
    const s = getSettings();
    expect(s.feedDays).toBe(DEFAULT_SETTINGS.feedDays);
    expect(s.revealSecrets).toBe(DEFAULT_SETTINGS.revealSecrets);
    expect(s.theme).toBe("oled");
    mem.set("tm.settings", "5");
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
