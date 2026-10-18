import { beforeEach, describe, expect, it, vi } from "vitest";
import { handle, type Env } from "../../cloudflare/src/index";
import { fakePsn, freshDatabase, SECRET } from "./helpers/worker";

// O app (lib/cloud.ts) conversando com o servidor de verdade (Worker + SQLite):
// confere que os dois lados combinam.
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

let psnToken = "token-da-ana-xxxxxxxxxxxxxxxx";
vi.mock("../src/psn/auth", () => ({ getAccessToken: async () => psnToken }));
vi.stubEnv("VITE_CLOUD_URL", "https://api.test/");

let env: Env;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
  handle(new Request(String(input), init), env, fakePsn)) as typeof fetch;

const cloud = await import("../src/lib/cloud");

beforeEach(() => {
  mem.clear();
  env = { DB: freshDatabase(), SESSION_SECRET: SECRET };
  psnToken = "token-da-ana-xxxxxxxxxxxxxxxx";
});

describe("app ↔ servidor dos recursos online", () => {
  it("conecta, curte, pede boost e o amigo recebe com o nome confirmado", async () => {
    expect(cloud.cloudAvailable()).toBe(true);
    expect(await cloud.connectCloud()).toEqual({ accountId: "111", onlineId: "Ana" });
    await cloud.syncLike("k1", "222", "🔥", true);
    expect(await cloud.sendBoostRequests(["222"], { from: "Outro", game: { name: "Jogo" } })).toBe(1);

    // Agora o Bruno, no celular dele.
    await cloud.disconnectCloud();
    psnToken = "token-do-bruno-xxxxxxxxxxxxxx";
    await cloud.connectCloud();
    expect((await cloud.likesFor(["k1"])).map((l) => l.liker_account_id)).toEqual(["111"]);
    expect((await cloud.likesOnMine("2000-01-01T00:00:00Z"))[0].online_id).toBe("Ana");
    const { received } = await cloud.myBoostRequests();
    expect(received[0].from_online_id).toBe("Ana");
    await cloud.answerBoostRequest(received[0].id, "aceito");
    expect((await cloud.appUsers(["111", "999", "demo-x"])).get("111")).toBe("Ana");
  });

  it("sessão recusada pelo servidor: confirma a conta de novo sozinho", async () => {
    await cloud.connectCloud();
    const saved = JSON.parse(mem.get("tm.cloud")!);
    mem.set("tm.cloud", JSON.stringify({ ...saved, token: "token.adulterado.xx" }));
    expect(await cloud.sendBoostRequests(["222"], { game: { name: "Jogo" } })).toBe(1);
  });

  it("sessões antigas do Supabase não valem: o app conecta de novo", async () => {
    mem.set("tm.cloud", JSON.stringify({ access_token: "x", refresh_token: "y" }));
    expect(await cloud.cloudIdentity()).toBeNull();
  });

  it("apagar meus dados limpa o servidor e desliga neste celular", async () => {
    await cloud.connectCloud();
    await cloud.syncLike("k1", "222", "🔥", true);
    await cloud.deleteCloudData();
    expect(await cloud.cloudIdentity()).toBeNull();
    psnToken = "token-do-bruno-xxxxxxxxxxxxxx";
    await cloud.connectCloud();
    expect(await cloud.likesFor(["k1"])).toEqual([]);
  });
});
