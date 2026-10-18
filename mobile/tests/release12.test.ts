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

const refresh = vi.fn();
vi.mock("psn-api", () => ({ exchangeAccessCodeForAuthTokens: vi.fn(), exchangeRefreshTokenForAuthTokens: refresh }));

const received = vi.fn();
vi.mock("../src/lib/cloud", () => ({
  myBoostRequests: async () => ({ received: received(), sent: [] }),
  answerBoostRequest: vi.fn(async () => {}),
}));

const { getAccessToken, SessionExpired } = await import("../src/psn/auth");
const { getInbox, removeFromInbox, syncCloudInbox } = await import("../src/lib/boostInbox");

describe("renovação do login", () => {
  beforeEach(() => {
    mem.clear();
    refresh.mockReset();
    // Token de acesso vencido, refresh token ainda válido.
    mem.set("tm.session", JSON.stringify({ accessToken: "a", accessExpiresAt: 0, refreshToken: "r", refreshExpiresAt: Date.now() + 1e9 }));
  });

  it("sem internet, não sai da conta", async () => {
    refresh.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await getAccessToken().catch((e) => e);
    expect(err).not.toBeInstanceOf(SessionExpired);
    expect(mem.get("tm.session")).toBeTruthy();
  });

  it("login recusado pela PSN expira a sessão", async () => {
    refresh.mockResolvedValue({ error: "invalid_grant" });
    await expect(getAccessToken()).rejects.toBeInstanceOf(SessionExpired);
  });
});

describe("pedidos de boost online", () => {
  beforeEach(() => mem.clear());

  it("um pedido apagado não volta na próxima sincronização", async () => {
    const req = { id: "c1", status: "aceito", created_at: "2026-10-18T10:00:00Z", payload: { from: "Aloy", game: { name: "Helldivers 2" } } };
    received.mockReturnValue([req]);
    expect(await syncCloudInbox()).toHaveLength(1);
    removeFromInbox(getInbox()[0].id);
    expect(await syncCloudInbox()).toHaveLength(0);
    expect(getInbox()).toHaveLength(0);
  });
});
