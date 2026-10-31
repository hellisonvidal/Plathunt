import { t } from "../i18n";
import { cached } from "../lib/cache";
import { getSettings } from "../lib/settings";
import {
  ADDONS_ID,
  ALL_ID,
  DEMOS_ID,
  mergeReleaseOrders,
  FREE_CATEGORY_IDS,
  FREE_ID,
  OFFER_CATEGORY_IDS,
  OFFERS_ID,
  PLUS_CATEGORY_IDS,
  PLUS_ID,
  PS4_ID,
  PS5_ID,
  storeRefreshMs,
  kindOf,
  parsePlusTrials,
  plusTrialProducts,
  type PlusTrial,
  toStoreProduct,
  type StoreProduct,
  type StoreRegion,
} from "../lib/store";

/**
 * Catálogo da PlayStation Store, pela mesma API pública que o site da loja
 * usa (GraphQL com consultas pré-registradas). Não precisa de login. No app,
 * o pedido passa pelo HTTP nativo do Capacitor (o navegador bloquearia).
 */
const ENDPOINT = "https://web.np.playstation.com/api/graphql/v1/op";
/** Hash da consulta "categoryGridRetrieve" do site da loja. */
const CATEGORY_GRID_HASH = "4ce7d410a4db2c8b635a48c1dcec375906ff63b19dadd87e073f8fd0c0481d35";
const PAGE_SIZE = 100;
/** Teto de segurança (20 mil jogos por categoria); na prática vem tudo o que a loja tiver. */
const MAX_PAGES = 200;
/** Páginas buscadas ao mesmo tempo. */
const PARALLEL = 4;
/** Complementos: só as primeiras páginas (os 3.000 mais vendidos). */
const ADDON_PAGES = 30;

/** Recebe os jogos já carregados (em ordem) e o total da categoria, enquanto o resto chega. */
export type StoreProgress = (products: StoreProduct[], total: number) => void;

/** Ordem da loja: mais vendidos (padrão) ou lançamentos, do mais novo ao mais antigo. */
type GridSort = "sales30" | "productReleaseDate";

async function fetchPage(categoryId: string, region: StoreRegion, offset: number, sort: GridSort = "sales30") {
  const variables = {
    id: categoryId,
    pageArgs: { size: PAGE_SIZE, offset },
    sortBy: { name: sort, isAscending: false },
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
  if (!res.ok) throw new Error(t("A PlayStation Store respondeu HTTP {status}", { status: String(res.status) }));
  const json = await res.json();
  const grid = json?.data?.categoryGridRetrieve;
  if (!grid) throw new Error(t("A PlayStation Store não devolveu o catálogo (a loja pode ter mudado)."));
  return {
    products: (grid.products ?? []).map(toStoreProduct) as StoreProduct[],
    total: (grid.pageInfo?.totalCount as number | undefined) ?? 0,
  };
}

const dedupe = (list: StoreProduct[]) => [...new Map(list.map((p) => [p.id, p])).values()];

/** Todas as páginas de uma categoria (várias ao mesmo tempo), avisando o progresso. */
async function fetchAll(
  categoryId: string,
  region: StoreRegion,
  onProgress?: StoreProgress,
  sort: GridSort = "sales30",
  maxPages = MAX_PAGES,
): Promise<StoreProduct[]> {
  const first = await fetchPage(categoryId, region, 0, sort);
  const pages: StoreProduct[][] = [first.products];
  const count = Math.min(maxPages, Math.ceil(first.total / PAGE_SIZE));
  onProgress?.(first.products, first.total);
  for (let start = 1; start < count; start += PARALLEL) {
    const batch = Array.from({ length: Math.min(PARALLEL, count - start) }, (_, i) => start + i);
    const results = await Promise.all(batch.map((page) => fetchPage(categoryId, region, page * PAGE_SIZE, sort)));
    results.forEach((r, i) => (pages[batch[i]] = r.products));
    onProgress?.(dedupe(pages.flat()), first.total);
    if (results.some((r) => r.products.length < PAGE_SIZE)) break;
  }
  return dedupe(pages.flat());
}

/**
 * Categorias que a Sony troca com frequência (Ofertas, Grátis, PS Plus): tenta
 * as categorias conhecidas da loja; se nenhuma existir neste país ou trouxer
 * jogos que se encaixam, monta a lista a partir do catálogo completo de PS5 e
 * PS4 (o mesmo do app, em cache) filtrando os jogos que se encaixam.
 */
/** Todos: PS5 e PS4 juntos (jogos das duas plataformas aparecem uma vez), mais as demos e as avaliações da PS Plus. */
async function fetchEverything(region: StoreRegion, force: boolean, onProgress?: StoreProgress) {
  const all = await fetchDerived([], () => true, region, force, onProgress, [PS5_ID, PS4_ID, DEMOS_ID]);
  const trials = await plusTrials(region, force).catch(() => [] as PlusTrial[]);
  return [...all, ...plusTrialProducts(trials, all)];
}

/**
 * Avaliações da PS Plus, da página oficial de jogos da PS Plus no país. Alguns
 * países (como o Brasil) deixam a lista vazia na página; aí vale a lista dos
 * EUA, que tem as mesmas avaliações da PS Plus Premium/Deluxe.
 */
async function plusTrials(region: StoreRegion, force: boolean): Promise<PlusTrial[]> {
  return cached(
    `store:${region}:avaliacoes-ps-plus`,
    storeRefreshMs(getSettings().storeUpdate),
    async () => {
      for (const locale of [region.toLowerCase(), "en-us"]) {
        const res = await fetch(`https://www.playstation.com/${locale}/ps-plus/games/`).catch(() => null);
        const list = res?.ok ? parsePlusTrials(await res.text()) : [];
        if (list.length > 0) return list;
      }
      return [];
    },
    force,
  );
}

async function fetchDerived(
  categoryIds: string[],
  pick: (p: StoreProduct) => boolean,
  region: StoreRegion,
  force: boolean,
  onProgress?: StoreProgress,
  /** Catálogos usados quando nenhuma das categorias serve. */
  fallback: string[] = [PS5_ID, PS4_ID],
): Promise<StoreProduct[]> {
  for (const id of categoryIds) {
    try {
      const first = await fetchPage(id, region, 0);
      if (!first.products.some(pick)) continue;
      const all = await fetchAll(id, region, (list, total) => onProgress?.(list.filter(pick), total));
      return all.filter(pick);
    } catch {
      // Categoria que não existe neste país: tenta a próxima.
    }
  }
  const found: StoreProduct[] = [];
  for (const id of fallback) {
    const list = await storeCategory(id, region, force, (partial) =>
      onProgress?.(dedupe([...found, ...partial]).filter(pick), 0),
    );
    found.push(...list);
  }
  return dedupe(found).filter(pick);
}

const DERIVED: Record<string, [string[], (p: StoreProduct) => boolean]> = {
  [OFFERS_ID]: [OFFER_CATEGORY_IDS, (p) => p.discount > 0],
  [FREE_ID]: [FREE_CATEGORY_IDS, (p) => p.isFree || p.price === 0],
  // Catálogo da PS Plus: na categoria da loja vale tudo; no catálogo geral, os marcados como PS Plus.
  [PLUS_ID]: [PLUS_CATEGORY_IDS, (p) => p.plus],
};

// "Todos" passou a incluir as demos e as avaliações: a chave nova faz a lista salva antes ser buscada de novo.
export const storeCacheKey = (region: StoreRegion, categoryId: string) =>
  `store:${region}:${categoryId === ALL_ID ? "todos-com-demos-e-avaliacoes" : categoryId}`;

/**
 * Jogos de uma categoria da loja (todos os que a loja tiver), na ordem de mais
 * vendidos. `onProgress` mostra os jogos enquanto as páginas chegam.
 */
export async function storeCategory(
  categoryId: string,
  region: StoreRegion,
  force = false,
  onProgress?: StoreProgress,
): Promise<StoreProduct[]> {
  return cached(
    storeCacheKey(region, categoryId),
    // Salva no celular; atualiza no intervalo escolhido em Configurações (ou ao puxar a tela).
    storeRefreshMs(getSettings().storeUpdate),
    () => {
      if (categoryId === ALL_ID) return fetchEverything(region, force, onProgress);
      // Complementos: dezenas de milhares na loja; ficam os mais vendidos.
      if (categoryId === ADDONS_ID) return fetchAll(ADDONS_ID, region, onProgress, "sales30", ADDON_PAGES);
      const derived = DERIVED[categoryId];
      return derived
        ? fetchDerived(derived[0], derived[1], region, force, onProgress)
        : fetchAll(categoryId, region, onProgress);
    },
    force,
  );
}

/**
 * Ordem de lançamento de todos os jogos da loja (ids, do mais novo ao mais
 * antigo). A loja não informa a data de cada jogo, só as listas de PS5 e de
 * PS4 já em ordem de lançamento; o app junta as duas. Fica salva como o catálogo.
 */
export async function storeReleaseOrder(region: StoreRegion, force = false): Promise<string[]> {
  return cached(
    `store:${region}:lancamentos`,
    storeRefreshMs(getSettings().storeUpdate),
    async () => {
      const ps5 = await fetchAll(PS5_ID, region, undefined, "productReleaseDate");
      const ps4 = await fetchAll(PS4_ID, region, undefined, "productReleaseDate");
      return mergeReleaseOrders([ps5, ps4]);
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
  ["Gran Turismo 7 – Demo", "UP9000-PPSA01316_00-GT7DEMO000000000", ["PS5"], 0, 0, true],
  ["Ghost of Tsushima – Trial", "UP9000-PPSA01717_00-GHOSTTRIAL000000", ["PS5"], 0, 0, true],
  ["God of War Ragnarök Edição Digital Deluxe", "UP9000-PPSA08338_00-GOWRDELUXE000000", ["PS5", "PS4"], 39990, 23994],
  ["Marvel's Spider-Man 2 + Miles Morales Bundle", "UP9000-PPSA03016_00-SPIDERMANBUNDLE0", ["PS5"], 44990, 26994],
  ["Horizon Forbidden West: Burning Shores (DLC)", "UP9000-PPSA01521_00-BURNINGSHORES000", ["PS5"], 9990, 6993],
];

export async function demoStoreCategory(categoryId: string): Promise<StoreProduct[]> {
  const plus = ["Returnal", "Sackboy: Uma Grande Aventura", "Bloodborne"];
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
            upsellServiceBranding: plus.includes(name) ? ["PS_PLUS"] : [],
          },
    }),
  );
  const pick: Record<string, (p: StoreProduct) => boolean> = {
    [ALL_ID]: () => true,
    [OFFERS_ID]: (p) => p.discount > 0,
    [PS5_ID]: (p) => p.platforms.includes("PS5"),
    [PS4_ID]: (p) => p.platforms.includes("PS4"),
    [DEMOS_ID]: (p) => kindOf(p) === "demo",
    [ADDONS_ID]: (p) => kindOf(p) === "dlc",
    [FREE_ID]: (p) => p.isFree,
    [PLUS_ID]: (p) => p.plus,
  };
  await new Promise((r) => setTimeout(r, 150));
  return all.filter(pick[categoryId] ?? (() => true));
}
