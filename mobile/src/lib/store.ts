import { locale, t } from "../i18n";
import { persistSet } from "./persist";

/**
 * Loja: catálogo da PlayStation Store e histórico de preços. A PSN não informa preços antigos, então o "menor preço" é o menor
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
  /** Faz parte da PS Plus (catálogo ou preço de assinante). */
  plus: boolean;
}

/** Categorias da loja (ids da PlayStation Store). */
export const OFFERS_ID = "ofertas";
export const PS5_ID = "4cbf39e2-5749-4970-ba81-93a489e4570c";
export const PS4_ID = "44d8bb20-653e-431e-8ad0-c0a365f68d2f";
/**
 * Categorias de promoção conhecidas. A Sony troca essas categorias a cada
 * campanha e por país, então "Ofertas" tenta todas e, se nenhuma trouxer
 * jogos com desconto, monta as ofertas a partir do catálogo de PS5 e PS4.
 */
export const OFFER_CATEGORY_IDS = [
  "dc464929-edee-48a5-bcd3-1e6f5250ae80",
  "3f772501-f6f8-49b7-abac-874a88ca4897",
  "803cee19-e5a1-4d59-a463-0b6b2701bf7c",
  "16b8d09a-d0e3-44e3-96cb-a3b2a21b6d69",
];
/** Categorias montadas pelo app (como Ofertas): tentam as da loja e, se vierem vazias, filtram o catálogo. */
export const ALL_ID = "todos";
export const FREE_ID = "gratis";
export const PLUS_ID = "psplus";
export const FREE_CATEGORY_IDS = ["d9930400-c5c7-4a06-a28d-cc74888426dc"];
export const PLUS_CATEGORY_IDS = ["038b4df3-bb4c-48f8-8290-3feb35f0f0fd"];
export const STORE_CATEGORIES = [
  /** Todos os jogos da loja: catálogo completo de PS5 e PS4 juntos. */
  { id: ALL_ID, label: "Todos" },
  { id: OFFERS_ID, label: "Ofertas" },
  { id: PS5_ID, label: "PS5" },
  { id: PS4_ID, label: "PS4" },
  { id: FREE_ID, label: "Grátis" },
  { id: PLUS_ID, label: "PS Plus" },
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
  price?: {
    basePrice?: string | null;
    discountedPrice?: string | null;
    isFree?: boolean;
    discountText?: string | null;
    isTiedToSubscription?: boolean;
    serviceBranding?: string[] | null;
    upsellServiceBranding?: string[] | null;
  } | null;
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
  const branding = [...(raw.price?.serviceBranding ?? []), ...(raw.price?.upsellServiceBranding ?? [])];
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
    plus: !!raw.price?.isTiedToSubscription || branding.some((b) => /PS_?PLUS/i.test(b)),
  };
}

export type StoreSort = "relevancia" | "desconto" | "menor-preco" | "maior-preco" | "nome" | "nome-desc";
export const STORE_SORTS: { value: StoreSort; label: string }[] = [
  { value: "relevancia", label: "Mais vendidos" },
  { value: "desconto", label: "Maior desconto" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "nome", label: "Nome (A–Z)" },
  { value: "nome-desc", label: "Nome (Z–A)" },
];

/** Faixa de preço: "gratis" ou [mínimo, máximo] em centavos (null = sem limite). */
export type PriceRange = "todas" | "gratis" | { min: number | null; max: number | null };

export interface StoreFilters {
  query: string;
  platform: "todas" | "PS5" | "PS4";
  onlyDiscount: boolean;
  /** Esconde os jogos que dependem da PS Plus (catálogo ou preço de assinante). */
  hidePlus: boolean;
  /** Esconde os jogos gratuitos. */
  hideFree: boolean;
  price: PriceRange;
  sort: StoreSort;
}

/** Limites das faixas de preço em cada moeda (em unidades, não centavos). */
const PRICE_STEPS: Record<StoreRegion, number[]> = {
  "pt-BR": [25, 50, 100, 150, 200, 250, 300, 400],
  "pt-PT": [5, 10, 20, 30, 40, 50, 60, 80],
  "en-US": [5, 10, 20, 30, 40, 50, 60, 80],
  "es-MX": [150, 300, 500, 700, 900, 1200, 1500, 1800],
  "es-AR": [5, 10, 20, 30, 40, 50, 60, 80],
  "es-ES": [5, 10, 20, 30, 40, 50, 60, 80],
};

/** Opções do filtro de preço na moeda da região (até X, X–Y, …, acima de Z). */
export function priceRanges(region: StoreRegion): { key: string; label: string; range: PriceRange }[] {
  const steps = PRICE_STEPS[region].map((n) => n * 100);
  const f = (cents: number) => formatPrice(cents, region).replace(/[.,]00(?=\D*$)/, "");
  const last = steps[steps.length - 1];
  return [
    { key: "todas", label: t("Qualquer"), range: "todas" },
    { key: "gratis", label: t("Grátis"), range: "gratis" },
    { key: `0-${steps[0]}`, label: t("Até {price}", { price: f(steps[0]) }), range: { min: 1, max: steps[0] } },
    ...steps.slice(1).map((max, i) => ({
      key: `${steps[i]}-${max}`,
      label: `${f(steps[i])} – ${f(max)}`,
      range: { min: steps[i] + 1, max } as PriceRange,
    })),
    { key: `${last}+`, label: t("Acima de {price}", { price: f(last) }), range: { min: last + 1, max: null } },
  ];
}

export const priceRangeKey = (r: PriceRange) =>
  typeof r === "string" ? r : r.max === null ? `${(r.min ?? 1) - 1}+` : `${(r.min ?? 1) - 1}-${r.max}`;

function inRange(p: StoreProduct, r: PriceRange): boolean {
  if (r === "todas") return true;
  if (r === "gratis") return p.isFree || p.price === 0;
  if (p.price === null || p.isFree || p.price === 0) return false;
  return (r.min === null || p.price >= r.min) && (r.max === null || p.price <= r.max);
}

/** Aplica busca, filtros e ordenação (a ordem da loja é a de "mais vendidos"). */
export function filterProducts(products: StoreProduct[], f: StoreFilters): StoreProduct[] {
  const q = f.query.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q)) &&
      (f.platform === "todas" || p.platforms.includes(f.platform)) &&
      (!f.onlyDiscount || p.discount > 0) &&
      !(f.hidePlus && p.plus) &&
      !(f.hideFree && (p.isFree || p.price === 0)) &&
      inRange(p, f.price),
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
      return [...list].sort((a, b) => a.name.localeCompare(b.name, locale(), { sensitivity: "base" }));
    case "nome-desc":
      return [...list].sort((a, b) => b.name.localeCompare(a.name, locale(), { sensitivity: "base" }));
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
// Histórico de preços (menor preço visto), no celular.

const PRICES_KEY = "tm.prices" as const;

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

/** Histórico lido uma vez e reaproveitado (cada cartão da loja consulta o seu preço). */
let bookCache: { raw: string | null; book: PriceBook } | null = null;

function readPriceBook(): PriceBook {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PRICES_KEY);
  } catch {}
  if (bookCache && bookCache.raw === raw) return bookCache.book;
  const book = readJson<unknown>(PRICES_KEY, {});
  const valid = book && typeof book === "object" && !Array.isArray(book) ? (book as PriceBook) : {};
  bookCache = { raw, book: valid };
  return valid;
}

export function priceHistory(region: StoreRegion, id: string): PriceRecord | null {
  const r = readPriceBook()[priceKey(region, id)];
  return r && typeof r.min === "number" ? r : null;
}

/** Endereço do produto na PlayStation Store (abre no navegador ou no app da loja). */
export function storeProductUrl(id: string, region: StoreRegion): string {
  return `https://store.playstation.com/${region.toLowerCase()}/product/${id}`;
}
