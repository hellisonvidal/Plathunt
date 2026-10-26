import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

vi.mock("../src/lib/notify", () => ({ cancelAllNotifications: () => Promise.resolve() }));

const { restoreAccount, savedAccounts, stashActive, forgetSaved } = await import("../src/lib/accounts");

describe("várias contas", () => {
  beforeEach(() => localStorage.clear());

  it("guarda a conta ativa com os dados dela e devolve tudo ao trocar de volta", () => {
    localStorage.setItem("tm.session", '{"refreshToken":"a"}');
    localStorage.setItem("tm.challenges", "[1]");
    localStorage.setItem("tm.settings", '{"theme":"oled"}');
    stashActive({ accountId: "A", onlineId: "Alice", avatarUrl: null });

    expect(localStorage.getItem("tm.session")).toBeNull();
    expect(localStorage.getItem("tm.challenges")).toBeNull();
    expect(localStorage.getItem("tm.settings")).toBe('{"theme":"oled"}');
    expect(savedAccounts().map((a) => a.onlineId)).toEqual(["Alice"]);

    localStorage.setItem("tm.session", '{"refreshToken":"b"}');
    stashActive({ accountId: "B", onlineId: "Bob", avatarUrl: null });
    expect(restoreAccount("A")).toBe(true);
    expect(localStorage.getItem("tm.session")).toBe('{"refreshToken":"a"}');
    expect(localStorage.getItem("tm.challenges")).toBe("[1]");
    expect(savedAccounts().map((a) => a.onlineId)).toEqual(["Bob"]);
  });

  it("remover uma conta salva apaga os dados dela", () => {
    localStorage.setItem("tm.session", "{}");
    stashActive({ accountId: "A", onlineId: "Alice", avatarUrl: null });
    forgetSaved("A");
    expect(savedAccounts()).toEqual([]);
    expect(restoreAccount("A")).toBe(false);
  });
});
