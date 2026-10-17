import { beforeEach, describe, expect, it } from "vitest";
import {
  discountPercent,
  filterProducts,
  getWishlist,
  isNewLow,
  parsePrice,
  priceHistory,
  recordPrices,
  refreshWishlist,
  toggleWish,
  toStoreProduct,
  type StoreFilters,
} from "../src/lib/store";

// localStorage simples para os testes (o Vitest roda em Node).
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const product = (id: string, name: string, base: string, price: string, platforms = ["PS5"]) =>
  toStoreProduct({ id, name, platforms, media: [{ role: "MASTER", type: "IMAGE", url: `https://img/${id}` }], price: { basePrice: base, discountedPrice: price, isFree: false } });

describe("preços da loja", () => {
  it("lê preços em vários formatos", () => {
    expect(parsePrice("R$ 249,90")).toBe(24990);
    expect(parsePrice("R$ 1.249,90")).toBe(124990);
    expect(parsePrice("US$29.99")).toBe(2999);
    expect(parsePrice("$1,299.99")).toBe(129999);
    expect(parsePrice("29,99 €")).toBe(2999);
    expect(parsePrice("Incluído")).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });
  it("calcula o desconto", () => {
    expect(discountPercent(10000, 2500)).toBe(75);
    expect(discountPercent(10000, 10000)).toBe(0);
    expect(product("a", "A", "R$ 200,00", "R$ 50,00").discount).toBe(75);
  });
  it("usa a imagem MASTER e marca jogos grátis", () => {
    expect(product("a", "A", "R$ 10,00", "R$ 10,00").imageUrl).toBe("https://img/a");
    const free = toStoreProduct({ id: "f", name: "F", price: { basePrice: "Gratuito", discountedPrice: "Gratuito", isFree: true } });
    expect([free.isFree, free.price]).toEqual([true, 0]);
  });
});

describe("filtros e ordenação", () => {
  const list = [
    product("1", "Zeta", "R$ 100,00", "R$ 100,00"),
    product("2", "Alfa", "R$ 300,00", "R$ 75,00", ["PS4"]),
    product("3", "Beta", "R$ 200,00", "R$ 150,00", ["PS5", "PS4"]),
  ];
  const base: StoreFilters = { query: "", platform: "todas", onlyDiscount: false, maxPrice: null, sort: "relevancia" };
  const ids = (f: Partial<StoreFilters>) => filterProducts(list, { ...base, ...f }).map((p) => p.id);
  it("ordena por maior desconto, preço e nome", () => {
    expect(ids({ sort: "desconto" })).toEqual(["2", "3", "1"]);
    expect(ids({ sort: "menor-preco" })).toEqual(["2", "1", "3"]);
    expect(ids({ sort: "maior-preco" })).toEqual(["3", "1", "2"]);
    expect(ids({ sort: "nome" })).toEqual(["2", "3", "1"]);
    expect(ids({})).toEqual(["1", "2", "3"]);
  });
  it("filtra por busca, plataforma, desconto e preço máximo", () => {
    expect(ids({ query: "bet" })).toEqual(["3"]);
    expect(ids({ platform: "PS4" })).toEqual(["2", "3"]);
    expect(ids({ onlyDiscount: true })).toEqual(["2", "3"]);
    expect(ids({ maxPrice: 10000 })).toEqual(["1", "2"]);
  });
});

describe("histórico de preços e lista de desejos", () => {
  beforeEach(() => mem.clear());
  it("guarda o menor preço visto e quando", () => {
    recordPrices([product("g", "G", "R$ 200,00", "R$ 100,00")], "pt-BR", new Date("2026-01-01"));
    recordPrices([product("g", "G", "R$ 200,00", "R$ 200,00")], "pt-BR", new Date("2026-02-01"));
    const h = priceHistory("pt-BR", "g")!;
    expect([h.min, h.last, h.minAt.slice(0, 10)]).toEqual([10000, 20000, "2026-01-01"]);
    expect(priceHistory("en-US", "g")).toBeNull();
    // Primeira vez não é "recorde"; um preço mais baixo depois é.
    expect(isNewLow(h, 20000)).toBe(false);
    recordPrices([product("g", "G", "R$ 200,00", "R$ 80,00")], "pt-BR", new Date("2026-03-01"));
    expect(isNewLow(priceHistory("pt-BR", "g"), 8000)).toBe(true);
    recordPrices([product("n", "N", "R$ 10,00", "R$ 10,00")], "pt-BR");
    expect(isNewLow(priceHistory("pt-BR", "n"), 1000)).toBe(false);
  });
  it("adiciona, atualiza e remove da lista de desejos", () => {
    const p = product("w", "W", "R$ 100,00", "R$ 100,00");
    expect(toggleWish(p, "pt-BR")).toBe(true);
    refreshWishlist([product("w", "W", "R$ 100,00", "R$ 40,00")], "pt-BR");
    expect(getWishlist()[0].product.discount).toBe(60);
    expect(toggleWish(p, "pt-BR")).toBe(false);
    expect(getWishlist()).toHaveLength(0);
  });
});
