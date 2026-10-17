import { useEffect, useState } from "react";
import { persistSet } from "./persist";

/**
 * Loja: catálogo da PlayStation Store, lista de desejos e histórico de
 * preços. A PSN não informa preços antigos, então o "menor preço" é o menor
 * que o app já viu neste celular (cada vez que a loja é aberta, os preços
 * vistos ficam registrados).
 */

export interface StoreProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  platforms: string[];
  /** Preço cheio e preço atual, como a loja mostra ("R$ 249,90"). */
  basePriceText: string | null;
  priceText: string | null;
  /** Em centavos; null quando não dá para ler (ex.: "Incluído"). */
  basePrice: number | null;
  price: number | null;
  isFree: boolean;
  /** % de desconto (0 sem desconto). */
  discount: number;
}

/** Categorias da loja (ids da PlayStation Store). */
export const STORE_CATEGORIES = [
  { id: "803cee19-e5a1-4d59-a463-0b6b2701bf7c", label: "Ofertas" },
  { id: "4cbf39e2-5749-4970-ba81-93a489e4570c", label: "PS5" },
  { id: "44d8bb20-653e-431e-8ad0-c0a365f68d2f", label: "PS4" },
  { id: "d9930400-c5c7-4a06-a28d-cc74888426dc", label: "Grátis" },
  { id: "038b4df3-bb4c-48f8-8290-3feb35f0f0fd", label: "PS Plus" },
] as const;

/** Regiões da loja (definem moeda e preços). */
export const STORE_REGIONS = [
  { value: "pt-BR", label: "Brasil" },
  { value: "pt-PT", label: "Portugal" },
  { value: "en-US", label: "Estados Unidos" },
  { value: "es-MX", label: "México" },
  { value: "es-AR", label: "Argentina" },
  { value: "es-ES", label: "Espanha" },
] as const;
export type StoreRegion = (typeof STORE_REGIONS)[number]["value"];

/**
 * Lê um preço da loja em centavos: "R$ 1.249,90", "US$29.99", "29,99 €".
 * O separador decimal é o último "." ou "," seguido de exatamente 2 dígitos.
 */
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d.,]/g, "");
  if (!/\d/.test(digits)) return null;
  const m = digits.match(/^(.*)[.,](\d{2})$/);
  const whole = (m ? m[1] : digits).replace(/[.,]/g, "");
  const cents = m ? m[2] : "00";
  const value = Number(whole || "0") * 100 + Number(cents);
  return Number.isFinite(value) ? value : null;
}

/** % de desconto entre o preço cheio e o atual. */
export function discountPercent(base: number | null, price: number | null): number {
  if (!base || price === null || price >= base) return 0;
  return Math.round((1 - price / base) * 100);
}

interface RawGridProduct {
  id: string;
  name: string;
  platforms?: string[];
  media?: { role?: string; type?: string; url?: string }[];
  price?: { basePrice?: string | null; discountedPrice?: string | null; isFree?: boolean; discountText?: string | null } | null;
}

/** Converte um produto da resposta `categoryGridRetrieve` da loja. */
export function toStoreProduct(raw: RawGridProduct): StoreProduct {
  const media = raw.media ?? [];
  const image =
    media.find((m) => m.role === "MASTER" && m.type === "IMAGE") ??
    media.find((m) => m.role === "GAMEHUB_COVER_ART") ??
    media.find((m) => m.type === "IMAGE");
  const isFree = !!raw.price?.isFree;
  const basePriceText = raw.price?.basePrice ?? null;
  const priceText = raw.price?.discountedPrice ?? basePriceText;
  const basePrice = isFree ? 0 : parsePrice(basePriceText);
  const price = isFree ? 0 : (parsePrice(priceText) ?? basePrice);
  const fromText = Number(raw.price?.discountText?.match(/(\d+)\s*%/)?.[1]);
  return {
    id: raw.id,
    name: raw.name,
    imageUrl: image?.url ?? null,
    platforms: raw.platforms ?? [],
    basePriceText,
    priceText,
    basePrice,
    price,
    isFree,
    discount: Number.isFinite(fromText) && fromText > 0 ? fromText : discountPercent(basePrice, price),
  };
}

export type StoreSort = "relevancia" | "desconto" | "menor-preco" | "maior-preco" | "nome";
export const STORE_SORTS: { value: StoreSort; label: string }[] = [
  { value: "relevancia", label: "Mais vendidos" },
  { value: "desconto", label: "Maior desconto" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "nome", label: "Nome (A–Z)" },
];

export interface StoreFilters {
  query: string;
  platform: "todas" | "PS5" | "PS4";
  onlyDiscount: boolean;
  /** Preço máximo em centavos (null = sem limite). */
  maxPrice: number | null;
  sort: StoreSort;
}

/** Aplica busca, filtros e ordenação (a ordem da loja é a de "mais vendidos"). */
export function filterProducts(products: StoreProduct[], f: StoreFilters): StoreProduct[] {
  const q = f.query.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q)) &&
      (f.platform === "todas" || p.platforms.includes(f.platform)) &&
      (!f.onlyDiscount || p.discount > 0) &&
      (f.maxPrice === null || (p.price !== null && p.price <= f.maxPrice)),
  );
  const price = (p: StoreProduct) => p.price ?? Number.MAX_SAFE_INTEGER;
  switch (f.sort) {
    case "desconto":
      return [...list].sort((a, b) => b.discount - a.discount || price(a) - price(b));
    case "menor-preco":
      return [...list].sort((a, b) => price(a) - price(b));
    case "maior-preco":
      return [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    case "nome":
      return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    default:
      return list;
  }
}

/** Formata centavos na moeda da região. */
export function formatPrice(cents: number, region: StoreRegion): string {
  const currency: Record<StoreRegion, string> = {
    "pt-BR": "BRL",
    "pt-PT": "EUR",
    "en-US": "USD",
    "es-MX": "MXN",
    "es-AR": "ARS",
    "es-ES": "EUR",
  };
  try {
    return (cents / 100).toLocaleString(region, { style: "currency", currency: currency[region] });
  } catch {
    // WebView sem dados de moeda: mostra o número com o código da moeda.
    return `${currency[region]} ${(cents / 100).toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Histórico de preços (menor preço visto) e lista de desejos, no celular.

const PRICES_KEY = "tm.prices" as const;
const WISHLIST_KEY = "tm.wishlist" as const;

export interface PriceRecord {
  /** Menor preço visto (centavos) e quando. */
  min: number;
  minAt: string;
  /** Último preço visto. */
  last: number;
  lastAt: string;
  /** Primeira vez que o app viu o jogo. */
  firstAt?: string;
}
type PriceBook = Record<string, PriceRecord>;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
};

/** Chave por região: o mesmo jogo tem preços diferentes em cada país. */
const priceKey = (region: StoreRegion, id: string) => `${region}:${id}`;

/** Registra os preços vistos agora; devolve o histórico atualizado. */
export function recordPrices(products: StoreProduct[], region: StoreRegion, now = new Date()): PriceBook {
  const book = readPriceBook();
  const at = now.toISOString();
  for (const p of products) {
    if (p.price === null) continue;
    const k = priceKey(region, p.id);
    const prev = book[k];
    book[k] = !prev
      ? { min: p.price, minAt: at, last: p.price, lastAt: at, firstAt: at }
      : p.price < prev.min
        ? { ...prev, min: p.price, minAt: at, last: p.price, lastAt: at }
        : { ...prev, last: p.price, lastAt: at };
  }
  persistSet(PRICES_KEY, JSON.stringify(book));
  return book;
}

/** O preço atual é um recorde: mais baixo que algum preço visto antes. */
export function isNewLow(record: PriceRecord | null, price: number | null): boolean {
  if (!record || price === null || price !== record.min) return false;
  return new Date(record.minAt).getTime() > new Date(record.firstAt ?? record.minAt).getTime();
}

function readPriceBook(): PriceBook {
  const book = readJson<unknown>(PRICES_KEY, {});
  return book && typeof book === "object" && !Array.isArray(book) ? (book as PriceBook) : {};
}

export function priceHistory(region: StoreRegion, id: string): PriceRecord | null {
  const r = readPriceBook()[priceKey(region, id)];
  return r && typeof r.min === "number" ? r : null;
}

/** Item da lista de desejos: guarda o produto para mostrar mesmo sem abrir a categoria. */
export interface WishItem {
  product: StoreProduct;
  region: StoreRegion;
  addedAt: string;
}

const wishListeners = new Set<() => void>();

export function getWishlist(): WishItem[] {
  const list = readJson<unknown>(WISHLIST_KEY, []);
  return Array.isArray(list)
    ? list.filter((w): w is WishItem => !!w && typeof w === "object" && !!(w as WishItem).product?.id)
    : [];
}

export function toggleWish(product: StoreProduct, region: StoreRegion): boolean {
  const list = getWishlist();
  const exists = list.some((w) => w.product.id === product.id && w.region === region);
  const next = exists
    ? list.filter((w) => !(w.product.id === product.id && w.region === region))
    : [...list, { product, region, addedAt: new Date().toISOString() }];
  persistSet(WISHLIST_KEY, JSON.stringify(next));
  wishListeners.forEach((l) => l());
  return !exists;
}

/** Atualiza os produtos da lista de desejos com os dados mais novos vistos na loja. */
export function refreshWishlist(products: StoreProduct[], region: StoreRegion) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const list = getWishlist();
  let changed = false;
  const next = list.map((w) => {
    const fresh = w.region === region ? byId.get(w.product.id) : undefined;
    if (!fresh) return w;
    changed = true;
    return { ...w, product: fresh };
  });
  if (changed) {
    persistSet(WISHLIST_KEY, JSON.stringify(next));
    wishListeners.forEach((l) => l());
  }
}

export function useWishlist(): WishItem[] {
  const [list, setList] = useState(getWishlist);
  useEffect(() => {
    const sync = () => setList(getWishlist());
    wishListeners.add(sync);
    return () => void wishListeners.delete(sync);
  }, []);
  return list;
}

/** Endereço do produto na PlayStation Store (abre no navegador ou no app da loja). */
export function storeProductUrl(id: string, region: StoreRegion): string {
  return `https://store.playstation.com/${region.toLowerCase()}/product/${id}`;
}
