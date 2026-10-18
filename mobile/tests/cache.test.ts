import { describe, expect, it } from "vitest";

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    // Simula o limite do localStorage: listas grandes não cabem.
    if (v.length > 300_000) throw new Error("QuotaExceededError");
    mem.set(k, v);
  },
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { cached, peekCached } = await import("../src/lib/cache");
const { storeRefreshMs } = await import("../src/lib/store");

describe("cache", () => {
  it("guarda o que é pequeno no localStorage e devolve sem buscar de novo", async () => {
    let calls = 0;
    const load = async () => ++calls;
    expect(await cached("a", 60_000, load)).toBe(1);
    expect(await cached("a", 60_000, load)).toBe(1);
    expect(mem.has("tm.cache.a")).toBe(true);
    expect(await cached("a", 60_000, load, true)).toBe(2);
  });

  it("listas grandes não vão para o localStorage, mas continuam disponíveis", async () => {
    const big = Array.from({ length: 20_000 }, (_, i) => ({ id: `produto-${i}`, name: "Jogo com um nome comprido" }));
    await cached("loja", 60_000, async () => big);
    expect(mem.has("tm.cache.loja")).toBe(false);
    expect((await peekCached<typeof big>("loja"))?.value).toHaveLength(20_000);
  });

  it("peekCached devolve a cópia salva mesmo vencida", async () => {
    await cached("velho", 1, async () => "salvo");
    await new Promise((r) => setTimeout(r, 5));
    expect((await peekCached<string>("velho"))?.value).toBe("salvo");
  });
});

describe("storeRefreshMs", () => {
  it("converte a escolha das Configurações", () => {
    expect(storeRefreshMs("6h")).toBe(6 * 3_600_000);
    expect(storeRefreshMs("manual")).toBe(Number.POSITIVE_INFINITY);
  });
});
