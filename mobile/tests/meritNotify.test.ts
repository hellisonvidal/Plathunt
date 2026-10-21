import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
let full = false;
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (full && k === "tm.merits") throw new Error("QuotaExceededError");
    mem.set(k, v);
  },
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const sent: { key: string; title: string }[] = [];
vi.mock("../src/lib/notify", () => ({
  notificationsEnabled: (kind: string) => kind === "merits",
  notify: async (_kind: string, key: string, title: string) => void sent.push({ key, title }),
}));
vi.mock("../src/lib/settings", async (orig) => ({
  ...(await orig<typeof import("../src/lib/settings")>()),
  getSettings: () => ({ notifications: true }),
}));

const { runBackgroundChecks } = await import("../src/lib/checks");

const c = (platinum: number) => ({ platinum, gold: 0, silver: 0, bronze: platinum * 10 });
let platinums = 1;
const client = {
  me: async () => ({ accountId: "acc", onlineId: "eu", avatarUrl: null, aboutMe: null, isPlus: false, level: 10, levelProgress: 0, earned: c(platinums) }),
  titles: async () =>
    Array.from({ length: platinums }, (_, i) => ({
      id: `G${i}`, service: "trophy2", name: `Jogo ${i}`, iconUrl: null, platform: "PS5", progress: 100,
      earned: c(1), defined: c(1), lastUpdated: "2026-10-01T00:00:00Z", hasGroups: false,
    })),
  playedGames: async () => [],
  friendIds: async () => [],
} as never;

const HOUR = 3_600_000;
describe("aviso de novos méritos", () => {
  beforeEach(() => {
    mem.clear();
    sent.length = 0;
    full = false;
    platinums = 1;
  });

  it("avisa só uma vez cada mérito novo, sem repetir nas verificações seguintes", async () => {
    await runBackgroundChecks(client, 1 * HOUR); // primeira vez: só registra
    expect(sent).toHaveLength(0);
    platinums = 2;
    await runBackgroundChecks(client, 2 * HOUR);
    expect(sent).toHaveLength(1);
    expect(sent[0].key).toBe("merits:new");
    await runBackgroundChecks(client, 3 * HOUR);
    await runBackgroundChecks(client, 4 * HOUR);
    expect(sent).toHaveLength(1);
  });

  it("não avisa quando o celular não consegue guardar os méritos", async () => {
    await runBackgroundChecks(client, 1 * HOUR);
    full = true;
    platinums = 2;
    await runBackgroundChecks(client, 2 * HOUR);
    await runBackgroundChecks(client, 3 * HOUR);
    expect(sent).toHaveLength(0);
  });

  it("méritos novos de uma atualização entram sem aviso", async () => {
    await runBackgroundChecks(client, 1 * HOUR);
    const state = JSON.parse(mem.get("tm.checks")!);
    mem.set("tm.checks", JSON.stringify({ ...state, meritCatalog: 2000 }));
    // simula méritos que a versão antiga não tinha: apaga parte dos registrados
    const book = JSON.parse(mem.get("tm.merits")!);
    const ids = Object.keys(book.acc);
    for (const id of ids.slice(0, Math.floor(ids.length / 2))) delete book.acc[id];
    mem.set("tm.merits", JSON.stringify(book));
    await runBackgroundChecks(client, 2 * HOUR);
    expect(sent).toHaveLength(0);
  });
});
