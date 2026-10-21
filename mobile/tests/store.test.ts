import { beforeEach, describe, expect, it } from "vitest";
import {
  discountPercent,
  filterProducts,
  isNewLow,
  parsePrice,
  priceHistory,
  priceRangeKey,
  priceRanges,
  recordPrices,
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
  const base: StoreFilters = { query: "", platform: "todas", onlyDiscount: false, hidePlus: false, hideFree: false, price: "todas", sort: "relevancia" };
  const ids = (f: Partial<StoreFilters>) => filterProducts(list, { ...base, ...f }).map((p) => p.id);
  it("ordena por maior desconto, preço e nome", () => {
    expect(ids({ sort: "desconto" })).toEqual(["2", "3", "1"]);
    expect(ids({ sort: "menor-preco" })).toEqual(["2", "1", "3"]);
    expect(ids({ sort: "maior-preco" })).toEqual(["3", "1", "2"]);
    expect(ids({ sort: "nome" })).toEqual(["2", "3", "1"]);
    expect(ids({ sort: "nome-desc" })).toEqual(["1", "3", "2"]);
    expect(ids({})).toEqual(["1", "2", "3"]);
  });
  it("filtra por busca, plataforma, desconto e preço máximo", () => {
    expect(ids({ query: "bet" })).toEqual(["3"]);
    expect(ids({ platform: "PS4" })).toEqual(["2", "3"]);
    expect(ids({ onlyDiscount: true })).toEqual(["2", "3"]);
    expect(ids({ hidePlus: true })).toEqual(ids({}));
    expect(ids({ price: { min: 1, max: 10000 } })).toEqual(["1", "2"]);
    expect(ids({ price: { min: 10001, max: null } })).toEqual(["3"]);
    expect(ids({ price: "gratis" })).toEqual([]);
  });
  it("aceita várias opções ao mesmo tempo (lista vazia = todas)", () => {
    expect(ids({ platform: [] })).toEqual(["1", "2", "3"]);
    expect(ids({ platform: ["PS5", "PS4"] })).toEqual(["1", "2", "3"]);
    expect(ids({ platform: ["PS4"] })).toEqual(["2", "3"]);
    // Duas faixas de preço: vale estar em qualquer uma.
    expect(ids({ price: [{ min: 1, max: 8000 }, { min: 10001, max: null }] })).toEqual(["2", "3"]);
    expect(ids({ price: [] })).toEqual(["1", "2", "3"]);
    // A faixa digitada também conta.
    expect(ids({ price: [], customPrice: { min: 10001, max: null } })).toEqual(["3"]);
    expect(ids({ kind: ["jogo", "pacote"] })).toEqual(["1", "2", "3"]);
    expect(ids({ kind: ["demo"] })).toEqual([]);
  });
});

describe("faixas de preço", () => {
  it("monta as faixas na moeda da região e reconhece a escolhida", () => {
    const ranges = priceRanges("pt-BR");
    expect(ranges.map((r) => r.key)).toEqual([
      "todas", "gratis", "0-500", "500-1000", "1000-2500", "2500-5000", "5000-10000", "10000-15000", "15000-20000", "20000-25000", "25000-30000", "30000-40000", "40000+",
    ]);
    expect(ranges[2].label).toMatch(/^Até R\$\s5$/);
    expect(ranges[3].label).toMatch(/^R\$\s5 – R\$\s10$/);
    for (const r of ranges) expect(priceRangeKey(r.range)).toBe(r.key);
    const free = toStoreProduct({ id: "f", name: "F", price: { basePrice: "Gratuito", discountedPrice: "Gratuito", isFree: true } });
    const cheap = product("c", "C", "R$ 49,90", "R$ 49,90");
    const filter = (key: string) =>
      filterProducts([free, cheap], { query: "", platform: "todas", onlyDiscount: false, hidePlus: false, hideFree: false, sort: "relevancia", price: ranges.find((r) => r.key === key)!.range }).map((p) => p.id);
    expect(filter("gratis")).toEqual(["f"]);
    expect(filter("2500-5000")).toEqual(["c"]);
    expect(filter("5000-10000")).toEqual([]);
    const all = { query: "", platform: "todas" as const, onlyDiscount: false, hidePlus: false, sort: "relevancia" as const, price: "todas" as const };
    expect(filterProducts([free, cheap], { ...all, hideFree: true }).map((p) => p.id)).toEqual(["c"]);
    expect(filterProducts([free, cheap], { ...all, hideFree: false, price: { min: 4001, max: 5000 } }).map((p) => p.id)).toEqual(["c"]);
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
});

describe("dados salvos corrompidos", () => {
  beforeEach(() => mem.clear());
  it("histórico de preços inválido vira vazio", () => {
    mem.set("tm.prices", "[1,2]");
    expect(priceHistory("pt-BR", "x")).toBeNull();
  });
});

describe("PS Plus", () => {
  it("marca jogos com selo da PS Plus", () => {
    const base = { id: "p", name: "P", platforms: ["PS5"], media: [] };
    expect(toStoreProduct({ ...base, price: { basePrice: "R$ 10,00", upsellServiceBranding: ["PS_PLUS"] } }).plus).toBe(true);
    expect(toStoreProduct({ ...base, price: { basePrice: "Incluído", isTiedToSubscription: true } }).plus).toBe(true);
    expect(toStoreProduct({ ...base, price: { basePrice: "R$ 10,00", serviceBranding: ["NONE"] } }).plus).toBe(false);
  });
});

describe("esconder PS Plus", () => {
  it("tira da lista os jogos que dependem da assinatura", () => {
    const base = { platforms: ["PS5"], media: [] };
    const list = [
      toStoreProduct({ ...base, id: "a", name: "A", price: { basePrice: "R$ 10,00", upsellServiceBranding: ["PS_PLUS"] } }),
      toStoreProduct({ ...base, id: "b", name: "B", price: { basePrice: "R$ 10,00" } }),
    ];
    const f: StoreFilters = { query: "", platform: "todas", onlyDiscount: false, hidePlus: true, hideFree: false, price: "todas", sort: "relevancia" };
    expect(filterProducts(list, f).map((p) => p.id)).toEqual(["b"]);
  });
});

describe("tipo de produto", () => {
  it("lê a classificação da loja e, sem ela, o nome", async () => {
    const { productKind } = await import("../src/lib/store");
    expect(productKind("FULL_GAME", "Bloodborne")).toBe("jogo");
    expect(productKind("GAME_BUNDLE", "Pacote X")).toBe("pacote");
    expect(productKind("ADD-ON_PACK", "Burning Shores")).toBe("dlc");
    expect(productKind("SEASON_PASS", "Passe")).toBe("dlc");
    expect(productKind("VIRTUAL_CURRENCY", "1000 V-Bucks")).toBe("moeda");
    expect(productKind(null, "Gran Turismo 7 – Demo")).toBe("demo");
    expect(productKind(null, "Ghost of Tsushima – Trial")).toBe("avaliacao");
    expect(productKind(null, "Horizon: Burning Shores (DLC)")).toBe("dlc");
    expect(productKind(null, "Astro Bot")).toBe("jogo");
  });
});

describe("edição premium", () => {
  it("separa as edições especiais do jogo completo", async () => {
    const { productKind } = await import("../src/lib/store");
    expect(productKind("PREMIUM_EDITION", "Jogo X")).toBe("premium");
    expect(productKind("FULL_GAME", "Jogo X Deluxe Edition")).toBe("premium");
    expect(productKind(null, "Hogwarts Legacy Edição Digital Deluxe")).toBe("premium");
    expect(productKind("FULL_GAME", "Jogo X")).toBe("jogo");
    expect(productKind(null, "Jogo X Standard Edition")).toBe("jogo");
  });
});

describe("pacote do jogo (GAME_BUNDLE) da loja", () => {
  it("separa edições premium, pacotes de vários jogos e o jogo completo", async () => {
    const { productKind } = await import("../src/lib/store");
    const kind = (name: string) => productKind("GAME_BUNDLE · Pacote do jogo", name);
    // Edições especiais marcadas pela Sony como pacote do jogo.
    expect(kind("Premium Edition de FINAL FANTASY VII REVELATION")).toBe("premium");
    expect(kind("Premium Plus Edition de FINAL FANTASY VII REVELATION")).toBe("premium");
    expect(kind("Forza Horizon 6 Deluxe Edition")).toBe("premium");
    expect(kind("Grand Theft Auto VI: Ultimate Edition")).toBe("premium");
    expect(kind("Call of Duty®: Modern Warfare® 4 - Edição Cofre")).toBe("premium");
    expect(kind("God of War Laufey™ Upgrade para Digital Deluxe")).toBe("premium");
    expect(kind("Romancing SaGa 3: Destinies United Digital Deluxe Version")).toBe("premium");
    expect(kind("Bulwark: Falconeer Chronicles Digital Deluxe")).toBe("premium");
    expect(kind("Stupid Never Dies: Glorious Idiot Edition")).toBe("premium");
    // Vários jogos juntos.
    expect(kind("Trilogy Edition da Série FINAL FANTASY VII Remake")).toBe("pacote");
    expect(kind("We Were Here Series Bundle")).toBe("pacote");
    expect(kind("Paradise Pack 4 in 1")).toBe("pacote");
    expect(kind("Pacote Coleção Hazelight")).toBe("pacote");
    expect(kind("KINGDOM HEARTS Collection [I～III]")).toBe("pacote");
    expect(kind("Infection Free Zone x Besiege")).toBe("pacote");
    expect(kind("Disney/Pixar Toy Story: Retro Roundup! + Toy Story 3 Complete Edition Double Pack")).toBe("pacote");
    expect(kind("The Legend Of Fireball & Fortress Merge: Complete Editions")).toBe("pacote");
    // O próprio jogo (pré-venda com bônus).
    expect(kind("FINAL FANTASY VII REVELATION")).toBe("jogo");
    expect(kind("Grand Theft Auto VI")).toBe("jogo");
    expect(kind("Tomb Raider: Legacy of Atlantis")).toBe("jogo");
  });
});

describe("pacotes e contagem dos filtros", () => {
  it("reconhece pacotes de jogos pelo nome", async () => {
    const { productKind } = await import("../src/lib/store");
    expect(productKind(null, "Crash Bandicoot N. Sane Trilogy")).toBe("pacote");
    expect(productKind("FULL_GAME", "Marvel's Spider-Man 2 + Miles Morales Bundle")).toBe("pacote");
    expect(productKind(null, "Uncharted: Coleção Legado dos Ladrões")).toBe("pacote");
    expect(productKind(null, "God of War Ragnarök")).toBe("jogo");
  });

  it("separa edição premium, pacote e avaliação", async () => {
    const { productKind, kindOf, toStoreProduct } = await import("../src/lib/store");
    // A classificação da loja vale mais que o nome.
    expect(productKind("GAME_BUNDLE · Pacote de jogos", "Call of Duty Vault Edition")).toBe("premium");
    expect(productKind("PREMIUM_EDITION · Edição premium", "Jogo X")).toBe("premium");
    expect(productKind("ADD-ON_PACK · Complemento", "Pacote X")).toBe("dlc");
    // Palavras de edição só contam como edição, não no meio do título.
    expect(productKind(null, "Marvel Ultimate Alliance")).toBe("jogo");
    expect(productKind(null, "Ultimate Chicken Horse")).toBe("jogo");
    expect(productKind("FULL_GAME", "Mortal Kombat 11 Ultimate")).toBe("premium");
    expect(productKind("FULL_GAME", "EA SPORTS FC 25 Edição Ultimate")).toBe("premium");
    expect(productKind(null, "The Witcher 3 – Edição Jogo do Ano")).toBe("premium");
    // Jogo + passe/DLC é edição premium; vários jogos juntos são pacote.
    expect(productKind("FULL_GAME", "Elden Ring + Passe de Temporada")).toBe("premium");
    expect(productKind("FULL_GAME", "Crash + Spyro Bundle")).toBe("pacote");
    expect(productKind("FULL_GAME", "Deluxe Bundle")).toBe("pacote");
    expect(productKind(null, "Assassin's Creed 2 em 1")).toBe("pacote");
    expect(productKind(null, "Pacote de trajes Ninja")).toBe("dlc");
    // Avaliações de jogo, mesmo marcadas como jogo completo.
    expect(productKind("FULL_GAME · Jogo completo", "Avaliação do jogo: Hogwarts Legacy")).toBe("avaliacao");
    expect(productKind("TRIAL", "Hogwarts Legacy")).toBe("avaliacao");
    // O tipo é recalculado com as regras atuais, inclusive em listas salvas antigas.
    const raw = { id: "x", name: "Jogo X", storeDisplayClassification: "PREMIUM_EDITION", price: { basePrice: "R$ 10,00" } };
    expect(kindOf(toStoreProduct(raw))).toBe("premium");
    const old = { ...toStoreProduct({ id: "y", name: "Marvel Ultimate Alliance" }), kind: "premium" as const, classification: undefined };
    expect(kindOf(old)).toBe("jogo");
  });

  it("conta quantos jogos cada opção mostra", async () => {
    const { filterCounts } = await import("../src/lib/store");
    const list = [
      product("1", "Jogo A", "R$ 100,00", "R$ 50,00"),
      product("2", "Jogo B Bundle", "R$ 200,00", "R$ 200,00", ["PS4"]),
      product("3", "Jogo C – Demo", "R$ 0,00", "R$ 0,00"),
    ];
    const f = { query: "", platform: "todas", onlyDiscount: false, hidePlus: false, hideFree: false, price: "todas", sort: "relevancia", kind: "todos" } as const;
    const c = filterCounts(list, f, "pt-BR");
    expect(c.kind).toMatchObject({ todos: 3, jogo: 1, pacote: 1, demo: 1 });
    expect(c.kind.dlc ?? 0).toBe(0);
    expect(c.platform).toMatchObject({ todas: 3, PS5: 2, PS4: 1 });
    // Com o filtro de plataforma PS4, só o pacote conta nos tipos.
    expect(filterCounts(list, { ...f, platform: "PS4" }, "pt-BR").kind).toMatchObject({ todos: 1, pacote: 1 });
  });
});

describe("ordem de lançamento", () => {
  it("junta as listas de PS5 e PS4 mantendo a ordem de cada uma", async () => {
    const { mergeReleaseOrders, toStoreProduct } = await import("../src/lib/store");
    const p = (id: string, date: string) =>
      toStoreProduct({ id, name: id, media: [{ role: "MASTER", type: "IMAGE", url: `https://image.api.playstation.com/vulcan/ap/rnd/${date.slice(0, 6)}/${date.slice(6)}/x.jpg` }] });
    const ps5 = [p("a", "2026100112"), p("b", "2025050112"), p("c", "2021010112")];
    const ps4 = [p("x", "2026060112"), p("b", "2025050112"), p("y", "2015010112")];
    expect(mergeReleaseOrders([ps5, ps4])).toEqual(["a", "x", "b", "c", "y"]);
  });

  it("ordena por lançamento, do mais novo ou do mais antigo", async () => {
    const { filterProducts, toStoreProduct } = await import("../src/lib/store");
    const list = ["a", "b", "c"].map((id) => toStoreProduct({ id, name: id }));
    const f: StoreFilters = { query: "", platform: "todas", onlyDiscount: false, hidePlus: false, hideFree: false, price: "todas", sort: "lancamento-novos" };
    const order = ["c", "a", "b"];
    expect(filterProducts(list, f, order).map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(filterProducts(list, { ...f, sort: "lancamento-antigos" }, order).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});
