import { cached } from "../lib/cache";
import { toStoreProduct, type StoreProduct, type StoreRegion } from "../lib/store";

/**
 * Catálogo da PlayStation Store, pela mesma API pública que o site da loja
 * usa (GraphQL com consultas pré-registradas). Não precisa de login. No app,
 * o pedido passa pelo HTTP nativo do Capacitor (o navegador bloquearia).
 */
const ENDPOINT = "https://web.np.playstation.com/api/graphql/v1/op";
/** Hash da consulta "categoryGridRetrieve" do site da loja. */
const CATEGORY_GRID_HASH = "4ce7d410a4db2c8b635a48c1dcec375906ff63b19dadd87e073f8fd0c0481d35";
const PAGE_SIZE = 100;
/** Até 500 jogos por categoria: o suficiente para ordenar por desconto e buscar. */
const MAX_PAGES = 5;
const MIN = 60_000;

async function fetchPage(categoryId: string, region: StoreRegion, offset: number) {
  const variables = {
    id: categoryId,
    pageArgs: { size: PAGE_SIZE, offset },
    sortBy: { name: "sales30", isAscending: false },
    filterBy: [],
    facetOptions: [],
  };
  const extensions = { persistedQuery: { version: 1, sha256Hash: CATEGORY_GRID_HASH } };
  const url =
    `${ENDPOINT}?operationName=categoryGridRetrieve` +
    `&variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;
  const res = await fetch(url, {
    headers: { "x-psn-store-locale-override": region, "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`A PlayStation Store respondeu HTTP ${res.status}`);
  const json = await res.json();
  const grid = json?.data?.categoryGridRetrieve;
  if (!grid) throw new Error("A PlayStation Store não devolveu o catálogo (a loja pode ter mudado).");
  return {
    products: (grid.products ?? []).map(toStoreProduct) as StoreProduct[],
    total: (grid.pageInfo?.totalCount as number | undefined) ?? 0,
  };
}

/** Jogos de uma categoria da loja, na ordem de mais vendidos. */
export async function storeCategory(categoryId: string, region: StoreRegion, force = false): Promise<StoreProduct[]> {
  return cached(
    `store:${region}:${categoryId}`,
    30 * MIN,
    async () => {
      const first = await fetchPage(categoryId, region, 0);
      const all = [...first.products];
      const pages = Math.min(MAX_PAGES, Math.ceil(first.total / PAGE_SIZE));
      for (let page = 1; page < pages; page++) {
        const next = await fetchPage(categoryId, region, page * PAGE_SIZE);
        all.push(...next.products);
        if (next.products.length < PAGE_SIZE) break;
      }
      // A mesma edição pode aparecer duas vezes em páginas diferentes.
      return [...new Map(all.map((p) => [p.id, p])).values()];
    },
    force,
  );
}

/** Catálogo de exemplo para o modo demonstração (sem acesso à loja). */
const DEMO: [string, string, string[], number, number, boolean?][] = [
  ["Astro Bot", "UP9000-PPSA12345_00-ASTROBOT0000000", ["PS5"], 29990, 29990],
  ["God of War Ragnarök", "UP9000-PPSA08338_00-GOWRAGNAROK00000", ["PS5", "PS4"], 34990, 17495],
  ["Marvel's Spider-Man 2", "UP9000-PPSA03016_00-MARVELSSPIDERMAN2", ["PS5"], 34990, 20994],
  ["Horizon Forbidden West", "UP9000-PPSA01521_00-HORIZONFW0000000", ["PS5", "PS4"], 24990, 9996],
  ["The Last of Us Part I", "UP9000-PPSA03395_00-TLOUPART10000000", ["PS5"], 34990, 13996],
  ["Ghost of Tsushima", "UP9000-PPSA01717_00-GHOSTOFTSUSHIMA0", ["PS5", "PS4"], 24990, 12495],
  ["Gran Turismo 7", "UP9000-PPSA01316_00-GRANTURISMO70000", ["PS5", "PS4"], 34990, 17495],
  ["Ratchet & Clank: Em Uma Outra Dimensão", "UP9000-PPSA01474_00-RATCHETANDCLANK0", ["PS5"], 34990, 17495],
  ["Death Stranding Director's Cut", "UP9000-PPSA01688_00-DEATHSTRANDINGDC", ["PS5"], 19990, 7996],
  ["Demon's Souls", "UP9000-PPSA01341_00-DEMONSSOULS00000", ["PS5"], 34990, 34990],
  ["Uncharted: Coleção Legado dos Ladrões", "UP9000-PPSA02344_00-UNCHARTEDLOTC000", ["PS5"], 24990, 9996],
  ["Bloodborne", "UP9000-CUSA00900_00-BLOODBORNE000000", ["PS4"], 9990, 3996],
  ["Returnal", "UP9000-PPSA01284_00-RETURNAL00000000", ["PS5"], 24990, 9996],
  ["Sackboy: Uma Grande Aventura", "UP9000-PPSA01562_00-SACKBOY000000000", ["PS5", "PS4"], 19990, 5997],
  ["Fall Guys", "UP4950-PPSA02097_00-FALLGUYS00000000", ["PS5", "PS4"], 0, 0, true],
  ["Astro's Playroom", "UP9000-PPSA01325_00-ASTROSPLAYROOM00", ["PS5"], 0, 0, true],
];

export async function demoStoreCategory(categoryId: string): Promise<StoreProduct[]> {
  const all = DEMO.map(([name, id, platforms, base, price, free]) =>
    toStoreProduct({
      id,
      name,
      platforms,
      media: [],
      price: free
        ? { basePrice: "Gratuito", discountedPrice: "Gratuito", isFree: true }
        : {
            basePrice: `R$ ${(base / 100).toFixed(2).replace(".", ",")}`,
            discountedPrice: `R$ ${(price / 100).toFixed(2).replace(".", ",")}`,
            isFree: false,
          },
    }),
  );
  const pick: Record<string, (p: StoreProduct) => boolean> = {
    "803cee19-e5a1-4d59-a463-0b6b2701bf7c": (p) => p.discount > 0,
    "4cbf39e2-5749-4970-ba81-93a489e4570c": (p) => p.platforms.includes("PS5"),
    "44d8bb20-653e-431e-8ad0-c0a365f68d2f": (p) => p.platforms.includes("PS4"),
    "d9930400-c5c7-4a06-a28d-cc74888426dc": (p) => p.isFree,
    "038b4df3-bb4c-48f8-8290-3feb35f0f0fd": (p) => ["Returnal", "Sackboy: Uma Grande Aventura", "Bloodborne"].includes(p.name),
  };
  await new Promise((r) => setTimeout(r, 150));
  return all.filter(pick[categoryId] ?? (() => true));
}
