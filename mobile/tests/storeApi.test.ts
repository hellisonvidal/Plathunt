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

const PS5 = "4cbf39e2-5749-4970-ba81-93a489e4570c";
const PS4 = "44d8bb20-653e-431e-8ad0-c0a365f68d2f";

/** Loja falsa: PS5 com 250 jogos (1 em cada 10 com desconto), PS4 com 30; categorias de promoção vazias. */
function fakeStore(url: string) {
  const vars = JSON.parse(new URL(url).searchParams.get("variables")!);
  const sizes: Record<string, number> = { [PS5]: 250, [PS4]: 30 };
  const total = sizes[vars.id] ?? 0;
  const products = Array.from({ length: Math.max(0, Math.min(100, total - vars.pageArgs.offset)) }, (_, i) => {
    const n = vars.pageArgs.offset + i;
    const sale = n % 10 === 0;
    return { id: `${vars.id.slice(0, 3)}-${n}`, name: `Jogo ${n}`, platforms: [vars.id === PS5 ? "PS5" : "PS4"], media: [],
      price: n % 25 === 1
        ? { basePrice: "Gratuito", discountedPrice: "Gratuito", isFree: true }
        : { basePrice: "R$ 100,00", discountedPrice: sale ? "R$ 50,00" : "R$ 100,00", isFree: false,
            upsellServiceBranding: n % 50 === 2 ? ["PS_PLUS"] : [] } };
  });
  const body = { data: { categoryGridRetrieve: { products, pageInfo: { totalCount: total } } } };
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

describe("catálogo da loja", () => {
  beforeEach(() => {
    mem.clear();
    vi.stubGlobal("fetch", vi.fn(fakeStore));
  });

  it("carrega todas as páginas da categoria, avisando o progresso", async () => {
    const { storeCategory } = await import("../src/psn/store");
    const progress: number[] = [];
    const all = await storeCategory(PS5, "pt-BR", true, (list) => progress.push(list.length));
    expect(all).toHaveLength(250);
    expect(progress[0]).toBe(100);
    expect(progress.at(-1)).toBe(250);
  });

  it("Ofertas: sem categoria de promoção, usa os jogos com desconto de PS5 e PS4", async () => {
    const { storeCategory } = await import("../src/psn/store");
    const offers = await storeCategory("ofertas", "pt-BR", true);
    expect(offers.length).toBe(25 + 3);
    expect(offers.every((p) => p.discount === 50)).toBe(true);
  });

  it("Todos: junta o catálogo completo de PS5 e PS4", async () => {
    const { storeCategory } = await import("../src/psn/store");
    expect(await storeCategory("todos", "pt-BR", true)).toHaveLength(280);
  });

  it("Grátis e PS Plus: sem categoria da loja, filtram o catálogo completo", async () => {
    const { storeCategory } = await import("../src/psn/store");
    const free = await storeCategory("gratis", "pt-BR", true);
    expect(free.length).toBe(10 + 2);
    expect(free.every((p) => p.isFree)).toBe(true);
    const plus = await storeCategory("psplus", "pt-BR", true);
    expect(plus.length).toBe(5 + 1);
    expect(plus.every((p) => p.plus)).toBe(true);
  });
});
