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
  /** Tipo do produto (jogo completo, demo, avaliação, DLC...). Listas salvas antigas não têm: use `kindOf`. */
  kind?: StoreKind;
  /** Classificação da loja e o rótulo traduzido (ex.: "PREMIUM_EDITION · Edição premium"). */
  classification?: string | null;
  /**
   * Quando a Sony publicou as imagens do produto ("AAAAMMDDhh", do endereço
   * delas). A loja não informa a data de lançamento de cada jogo; isso só
   * serve para intercalar as listas de lançamentos de PS5 e PS4.
   */
  imageDate?: string | null;
  /** Página na loja quando não é a do produto (as avaliações abrem a página do jogo). */
  url?: string | null;
}

/** Tipos de produto da loja, para o selo no cartão e o filtro "Tipo". */
export type StoreKind = "jogo" | "premium" | "pacote" | "dlc" | "demo" | "avaliacao" | "moeda" | "outro";

export const STORE_KINDS: { value: StoreKind; label: string }[] = [
  { value: "jogo", label: "Jogo completo" },
  { value: "premium", label: "Edição premium" },
  { value: "pacote", label: "Pacote" },
  { value: "dlc", label: "DLC / complemento" },
  { value: "demo", label: "Demo" },
  { value: "avaliacao", label: "Avaliação" },
  { value: "moeda", label: "Moeda virtual" },
  { value: "outro", label: "Outros" },
];

/** Nome comparável para reconhecer o tipo: minúsculas, sem ™/® e com espaços simples. */
const kindName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[–—:()[\]|_（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Plataformas no nome ("PS4 & PS5", "para PS5", "(PlayStation 5)", "PS5+PSVR2"): não dizem nada do tipo. */
const PLATFORM = "(?:ps4|ps5|psvr2|psvr|ps vr2|playstation\\s?[45]|playstation vr2?)";
const PLATFORMS_IN_NAME = new RegExp(
  `(?:\\b(?:para|for|pour|für|per|en)\\s+)?\\b${PLATFORM}\\b(?:\\s*(?:&|e|y|et|and|und|\\+|/|,|-)\\s*\\b${PLATFORM}\\b)*`,
  "g",
);
const withoutPlatforms = (n: string) =>
  n
    // "PS4 Edition", "PS5 Upgrade Edition": a versão de uma plataforma, não uma edição especial.
    .replace(new RegExp(`\\b${PLATFORM}(?:\\s+upgrade)?\\s+(?:edition|edi[çc][ãa]o)\\b`, "g"), " ")
    .replace(/\bvr \+ non-vr\b/g, " ").replace(PLATFORMS_IN_NAME, " ").replace(/\s+/g, " ").trim();

/** Edição padrão ("Standard Edition", "Edição Padrão"...): é o próprio jogo, não edição premium. */
const STANDARD_NAME =
  /\b(standard|padr[ãa]o|est[áa]ndar|standardedition|base edition|edi[çc][ãa]o base|edici[óo]n base|normale|cross-gen(\s+digital)?(\s+(edition|bundle))?)\b/;

/**
 * Edições especiais de um jogo (Deluxe, Ultimate, Gold, Definitiva, Jogo do
 * Ano, "Jogo + Passe de Temporada"...). A palavra precisa vir como edição
 * ("Deluxe Edition", "Edição Deluxe" ou no fim do nome), para não confundir
 * jogos como "Marvel Ultimate Alliance" ou "Ultimate Chicken Horse". Vale
 * para produtos sem a classificação da loja (listas salvas antigas).
 */
const EDITION_WORDS =
  "deluxe|digital deluxe|super deluxe|ultimate|premium|gold|definitive|complete|collector'?s|special|vault|legendary|platinum|champions|anniversary|game of the year|goty|cross-gen|ultra|royal|year \\d+";
const PREMIUM_NAME = new RegExp(
  [
    `\\b(${EDITION_WORDS})\\s+(edition|edi[çc][ãa]o)\\b`,
    "\\bedi[çc][ãa]o\\s+(digital\\s+)?(deluxe|definitiva|completa|especial|de luxo|ouro|suprema|premium|ultimate|gold|lend[áa]ria|do colecionador|de colecionador|jogo do ano|platina|aniversário|campe[õo]es)\\b",
    "\\b(goty|game of the year|jogo do ano)\\b",
    "\\b(deluxe|ultimate|premium|gold|definitive|complete)$",
  ].join("|"),
);

/**
 * Edição especial com nome num "jogo completo" da loja: "Game of the Year
 * Edition", "Definitive Edition", "Complete Edition", "Edição Deluxe",
 * "Director's Cut"... A palavra antes de "Edition" precisa ser um nome
 * (não número nem plataforma); "Console Edition" e "VR Edition" são o próprio
 * jogo. Palavras soltas no fim ("Bard's Gold", "Spelunker HD Deluxe") não contam.
 */
const NAMED_EDITION = new RegExp(
  [
    "\\b(?!(?:console|vr|ps\\d|pc|standard|base|normal|regular|launch|lan[çc]amento|free|starter|upgrade|trial|demo)\\s)[a-zà-ÿ'’]{3,}\\s+(edition|edi[çc][ãa]o|edici[óo]n|[ée]dition)\\b",
    "\\b(edition|edi[çc][ãa]o|edici[óo]n|[ée]dition)\\s+(?!(?:console|vr|padr[ãa]o|standard|est[áa]ndar|base)\\b)(digital\\s+)?[a-zà-ÿ'’]{3,}",
    "\\b(goty|game of the year|jogo do ano|juego del a[ñn]o)\\b",
    "\\b(director'?s cut|vers[ãa]o do diretor|versi[óo]n del director)\\b",
  ].join("|"),
);

/** Qualquer edição ou versão especial (num "Pacote do jogo", que já é mais que o jogo). */
const ANY_EDITION =
  /\b(edition|edi[çc][ãa]o|edici[óo]n|[ée]dition|deluxe|de luxo|ultimate|premium|gold|definitive|definitiva|complete|completa|completo|goty|game of the year|jogo do ano|upgrade|atualiza[çc][ãa]o para|vault|cofre|director'?s cut|vers[ãa]o do diretor|enhanced)\b/;

/** O jogo com extras (passe, DLC, pacote de fundador, avatares...): edição premium, não pacote de jogos. */
const WITH_EXTRAS =
  /\b(season pass|passe de temporada|passe do ano|year pass|expansion pass|content pass|expans[ãa]o|expansion|dlcs?|add-ons?|complementos?|conte[úu]do adicional|supporter|apoiador|founder'?s|fundador(es)?|starter|iniciante|avatar|avatares|temas?|themes?|soundtrack|trilha sonora|costumes?|trajes?|skins?|bonus|b[ôo]nus|shark card|cash card|coins|moedas|points)\b/;

/** Vários jogos juntos, sem dúvida: coleção, trilogia, "2 em 1", "Double Pack", "Pacote de 5 jogos"... */
const SEVERAL_GAMES_NAME =
  /\b(collection|cole[çc][ãa]o|colecci[óo]n|trilogy|trilogia|anthology|antologia|duologia|duology|quadrilogy|saga completa|double pack|triple pack|dual pack|duo pack|pack duplo|pacote duplo|pacote triplo|quintpack|party pack|\d+\s?(em|in|en)\s?1|\d+-in-1|pacote de \d+ jogos|editions|edi[çc][õo]es|essentials)\b|\b\d+\b.*\b(t[íi]tulos|titles|jogos|games)\b/;
/** "Collection" como parte do nome de um só jogo: "Master Collection Version", "The Dark Pictures Anthology: Little Hope". */
const SINGLE_FROM_SERIES = /\bcollection version\b|\banthology\s*:(?!\s*vol)/;

/** Palavras de pacote (num "Pacote do jogo" ou num jogo completo com nome de pacote). */
const BUNDLE_WORDS = /\b(bundle|pacote|pack|combo|conjunto|set|series|vol\.?\s?\d+|volume \d+)\b/;
/** Dois nomes juntos: "A & B", "A + B", "A x B", "A / B", "A e B" (só num "Pacote do jogo"). */
const JOINED = /\s(&|\+|x|×|\/|and|e|y|et|und)\s/;

/** O tipo dentro de um "Pacote do jogo" (GAME_BUNDLE), que a Sony usa para quase tudo acima do jogo. */
/** "Jogo & Jogo - Expansão": o segundo nome é um complemento do primeiro. */
function joinedWithOwnDlc(n: string): boolean {
  const m = n.match(JOINED);
  if (!m || m.index === undefined) return false;
  const left = n.slice(0, m.index).trim();
  return left.length > 3 && n.slice(m.index + m[0].length).startsWith(`${left} - `);
}

/** `raw`: o nome em minúsculas com a pontuação (para "Anthology: Título"). */
function bundleKind(n: string, raw: string): StoreKind {
  if (SEVERAL_GAMES_NAME.test(n) && !SINGLE_FROM_SERIES.test(raw)) return "pacote";
  if (joinedWithOwnDlc(n)) return "premium";
  if (WITH_EXTRAS.test(n) || /\bupgrade\b/.test(n.replace(/\bfree upgrade\b/, ""))) return "premium";
  if (STANDARD_NAME.test(n)) return BUNDLE_WORDS.test(n) || JOINED.test(n) ? "pacote" : "jogo";
  if (ANY_EDITION.test(n)) return "premium";
  if (BUNDLE_WORDS.test(n) || JOINED.test(n)) return "pacote";
  // Sem sinal de vários jogos nem de edição: é o próprio jogo (às vezes com bônus de pré-venda).
  return "jogo";
}

/** O tipo de um "Jogo completo" (FULL_GAME): só muda com sinais fortes no nome. */
function fullGameKind(n: string, raw: string): StoreKind {
  const twoGames = / \+ /.test(n);
  const bundle = /\bbundle\b/.test(n);
  // "Jogo + Tema", "Game and Theme Bundle": o jogo com extras.
  if ((twoGames || bundle) && WITH_EXTRAS.test(twoGames ? n.slice(n.indexOf(" + ")) : n)) return "premium";
  if (STANDARD_NAME.test(n)) return "jogo";
  if ((SEVERAL_GAMES_NAME.test(n) && !SINGLE_FROM_SERIES.test(raw)) || bundle || twoGames) return "pacote";
  if (NAMED_EDITION.test(n)) return "premium";
  return "jogo";
}

/** Avaliações de jogos (PS Plus Premium e versões de teste). */
/**
 * Avaliações de jogos (PS Plus Premium e versões de teste). "Trial" sozinho só
 * no fim de um nome comprido ("Rainbow Six Extraction Trial"): há jogos
 * chamados "Taboo Trial", "Trial of Greed" ou "Urban Trial Tricky".
 */
const TRIAL_NAME =
  /\b(game trial|free trial|trial version|trial edition|avalia[çc][ãa]o|avalia[çc][ãa]o (do|de) jogo|avalia[çc][ãa]o gratuita|vers[ãa]o de (teste|avalia[çc][ãa]o)|teste gratuito|teste do jogo|prueba gratuita|versi[óo]n de prueba)\b|\s-\s*trial$|(\S+\s+){3,}trial$/;
const DEMO_NAME = /\b(demo|demonstra[çc][ãa]o|vers[ãa]o demo|prologue demo)\b/;
const DLC_NAME =
  /\b(season pass|passe de temporada|expans[ãa]o|expansion|dlc|add-on|complemento|pacote de (trajes|personagens|itens|mapas|fases|conte[úu]do)|soundtrack|trilha sonora|costume|traje)\b/;
const CURRENCY_NAME = /\b(v-bucks|moedas|coins|points pack|cr[ée]ditos|shark cash|cash card|cart[ãa]o de dinheiro|vc|cod points|apex coins)\b/;
/** Pacotes de jogos pelo nome, para produtos sem a classificação da loja. */
const BUNDLE_NAME =
  /\b(bundle|pacote|combo|double pack|triple pack|dual pack|pack duplo|pacote duplo|pacote triplo|collection|cole[çc][ãa]o|trilogy|trilogia|anthology|antologia|duologia|duology|quadrilogy|saga completa|\d\s?(em|in)\s?1|party pack)\b|\s\+\s/;

/**
 * Tipo do produto. A classificação da própria loja vem primeiro
 * (storeDisplayClassification: FULL_GAME, PREMIUM_EDITION, GAME_BUNDLE,
 * BUNDLE, ADD-ON_PACK, DEMO, TRIAL, VIRTUAL_CURRENCY..., e o rótulo traduzido
 * "Edição premium", "Pacote do jogo", "Avaliação de jogo"...). Avaliações,
 * demos e edições padrão são reconhecidas pelo nome em qualquer classificação.
 * No "Pacote do jogo" e no "Jogo completo" o nome separa jogo, edição premium
 * e pacote (as regras foram conferidas com o catálogo inteiro da loja).
 */
export function productKind(classification: string | null | undefined, name: string): StoreKind {
  const c = (classification ?? "").toUpperCase();
  const n = withoutPlatforms(kindName(name));
  const raw = name.toLowerCase();
  if (/TRIAL|AVALIA|TESTE/.test(c)) return "avaliacao";
  if (/DEMO/.test(c)) return "demo";
  if (/CURRENCY|MOEDA/.test(c)) return "moeda";
  // Complementos: a loja usa várias classificações (roupas, nível, episódio, armas, ingresso, faixa, "outro"...).
  if (/ADD|SEASON|LEVEL|CHARACTER|COSTUME|MAP|VEHICLE|ITEM|EXPANSION|DLC|COMPLEMENTO|PASSE|EXPANS|EPISOD|WEAPON|TICKET|TRACK|^OTHER/.test(c)) return "dlc";
  if (/APP|THEME|AVATAR|SOUNDTRACK|VIDEO|MUSIC|TEMA|APLICATIVO/.test(c)) return "outro";
  if (TRIAL_NAME.test(n)) return "avaliacao";
  if (DEMO_NAME.test(n)) return "demo";
  if (/PREMIUM|EDI[ÇC][ÃA]O/.test(c)) return STANDARD_NAME.test(n) ? "jogo" : "premium";
  if (/BUNDLE|PACOTE D[EO] JOGO|PACK/.test(c)) return bundleKind(n, raw);
  if (/FULL_GAME|^GAME$|JOGO COMPLETO|FULL GAME/.test(c)) return fullGameKind(n, raw);
  // Sem classificação (listas salvas antigas): só o nome.
  if (CURRENCY_NAME.test(n)) return "moeda";
  if (STANDARD_NAME.test(n)) return "jogo";
  if (PREMIUM_NAME.test(n) || / \+ .*\b(season pass|passe de temporada|expans[ãa]o|expansion|dlc)\b/.test(n)) return "premium";
  if (DLC_NAME.test(n)) return "dlc";
  if (BUNDLE_NAME.test(n)) return "pacote";
  return "jogo";
}

/** Tipo salvo pelas versões antigas → classificação equivalente (o nome é relido com as regras atuais). */
const LEGACY_CLASS: Partial<Record<StoreKind, string>> = {
  dlc: "ADD-ON",
  demo: "DEMO",
  avaliacao: "TRIAL",
  moeda: "VIRTUAL_CURRENCY",
  outro: "APP",
};

/**
 * Tipo de um produto, sempre com as regras atuais: usa a classificação da
 * loja guardada junto do jogo. Listas salvas antes dela não têm o campo.
 */
export const kindOf = (p: StoreProduct): StoreKind =>
  p.classification !== undefined
    ? productKind(p.classification, p.name)
    : productKind(p.kind ? (LEGACY_CLASS[p.kind] ?? null) : null, p.name);

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
/**
 * Demos gratuitas (PS5 e PS4). As categorias de PS5 e PS4 da loja só trazem
 * jogos completos, pacotes e edições premium; as demos ficam nesta.
 */
export const DEMOS_ID = "95601a70-7564-4771-b305-0283fe3593e4";
export const STORE_CATEGORIES = [
  /** Todos os jogos da loja: catálogo completo de PS5 e PS4 juntos, com as demos. */
  { id: ALL_ID, label: "Todos" },
  { id: OFFERS_ID, label: "Ofertas" },
  { id: PS5_ID, label: "PS5" },
  { id: PS4_ID, label: "PS4" },
  { id: FREE_ID, label: "Grátis" },
  { id: DEMOS_ID, label: "Demos" },
  { id: PLUS_ID, label: "PS Plus" },
] as const;

/** De quanto em quanto tempo a loja salva no celular é atualizada (Configurações). */
export const STORE_REFRESH = [
  { value: "30m", label: "A cada 30 minutos", ms: 30 * 60_000 },
  { value: "6h", label: "A cada 6 horas", ms: 6 * 3_600_000 },
  { value: "24h", label: "Uma vez por dia", ms: 24 * 3_600_000 },
  { value: "manual", label: "Só quando eu puxar para atualizar", ms: Number.POSITIVE_INFINITY },
] as const;
export type StoreRefresh = (typeof STORE_REFRESH)[number]["value"];

export const storeRefreshMs = (value: StoreRefresh) =>
  (STORE_REFRESH.find((o) => o.value === value) ?? STORE_REFRESH[1]).ms;

/** Regiões da loja (definem moeda e preços). */
export const STORE_REGIONS = [
  { value: "pt-BR", label: "Brasil" },
  { value: "pt-PT", label: "Portugal" },
  { value: "en-US", label: "Estados Unidos" },
  { value: "es-MX", label: "México" },
  { value: "es-AR", label: "Argentina" },
  { value: "es-ES", label: "Espanha" },
  { value: "fr-FR", label: "França" },
  { value: "de-DE", label: "Alemanha" },
  { value: "it-IT", label: "Itália" },
  { value: "en-GB", label: "Reino Unido" },
  { value: "ja-JP", label: "Japão" },
  { value: "en-CA", label: "Canadá" },
  { value: "en-AU", label: "Austrália" },
  { value: "es-CL", label: "Chile" },
  { value: "es-CO", label: "Colômbia" },
  { value: "es-PE", label: "Peru" },
] as const;
export type StoreRegion = (typeof STORE_REGIONS)[number]["value"];

/**
 * Loja do país da conta PSN (código ISO, como "BR"). Países sem loja própria no
 * app usam a mais parecida: mesma moeda e idioma (Áustria → Alemanha, Irlanda →
 * Reino Unido...). null quando não há nenhuma parecida.
 */
export function storeRegionForCountry(code: string | null | undefined): StoreRegion | null {
  const cc = (code ?? "").toUpperCase();
  const own = STORE_REGIONS.find((r) => r.value.slice(3) === cc);
  if (own) return own.value;
  const similar: Record<string, StoreRegion> = {
    AT: "de-DE", CH: "de-DE", LU: "fr-FR", BE: "fr-FR", MC: "fr-FR", IE: "en-GB", NZ: "en-AU",
    UY: "es-AR", PY: "es-AR", BO: "es-PE", EC: "es-PE", CR: "es-MX", GT: "es-MX", HN: "es-MX", NI: "es-MX",
    PA: "es-MX", SV: "es-MX",
  };
  return similar[cc] ?? null;
}

/** País da loja do aparelho (moeda e preços), quando a loja existe no app; senão, Estados Unidos. */
export function deviceStoreRegion(): StoreRegion {
  const tags = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const tag of tags.filter(Boolean)) {
    const found = STORE_REGIONS.find((r) => r.value.toLowerCase() === tag.toLowerCase());
    if (found) return found.value;
  }
  const base = tags.find(Boolean)?.slice(0, 2).toLowerCase();
  const byLanguage: Record<string, StoreRegion> = { pt: "pt-BR", es: "es-ES", fr: "fr-FR", de: "de-DE", it: "it-IT", ja: "ja-JP" };
  return (base && byLanguage[base]) || "en-US";
}

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
  storeDisplayClassification?: string | null;
  localizedStoreDisplayClassification?: string | null;
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

const classificationOf = (raw: RawGridProduct) =>
  [raw.storeDisplayClassification, raw.localizedStoreDisplayClassification].filter(Boolean).join(" · ") || null;

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
  const imageDates = media.flatMap((m) => m.url?.match(/\/rnd\/(\d{6})\/(\d{4})\//)?.slice(1, 3).join("") ?? []).sort();
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
    classification: classificationOf(raw),
    kind: productKind(classificationOf(raw), raw.name),
    imageDate: imageDates[0] ?? null,
  };
}

/**
 * Junta as listas de lançamentos de cada plataforma (cada uma já na ordem da
 * loja, do mais novo ao mais antigo) numa ordem só: a ordem de cada lista é
 * mantida e, entre as duas, vai primeiro o de imagens mais novas.
 */
export function mergeReleaseOrders(lists: StoreProduct[][]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const pos = lists.map(() => 0);
  for (;;) {
    let pick = -1;
    for (let i = 0; i < lists.length; i++) {
      while (pos[i] < lists[i].length && seen.has(lists[i][pos[i]].id)) pos[i]++;
      if (pos[i] >= lists[i].length) continue;
      if (pick < 0 || (lists[i][pos[i]].imageDate ?? "") > (lists[pick][pos[pick]].imageDate ?? "")) pick = i;
    }
    if (pick < 0) return out;
    const p = lists[pick][pos[pick]++];
    seen.add(p.id);
    out.push(p.id);
  }
}

export type StoreSort =
  | "relevancia"
  | "lancamento-novos"
  | "lancamento-antigos"
  | "desconto"
  | "menor-preco"
  | "maior-preco"
  | "nome"
  | "nome-desc";
/** `group`: opções agrupadas na lista (as de data de lançamento). */
export const STORE_SORTS: { value: StoreSort; label: string; group?: string }[] = [
  { value: "relevancia", label: "Mais vendidos" },
  { value: "lancamento-novos", label: "Mais recentes", group: "Data de lançamento" },
  { value: "lancamento-antigos", label: "Mais antigos", group: "Data de lançamento" },
  { value: "desconto", label: "Maior desconto" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "nome", label: "Nome (A–Z)" },
  { value: "nome-desc", label: "Nome (Z–A)" },
];

/** Faixa de preço: "gratis" ou [mínimo, máximo] em centavos (null = sem limite). */
export type PriceRange = "todas" | "gratis" | { min: number | null; max: number | null };

/** Plataformas da loja usadas no filtro. */
export type StorePlatform = "PS5" | "PS4";

/**
 * Filtros da loja. Plataforma, tipo e preço aceitam várias opções ao mesmo
 * tempo (lista; vazia = todas). Um valor único também vale (filtros antigos).
 */
export interface StoreFilters {
  query: string;
  platform: "todas" | StorePlatform | StorePlatform[];
  onlyDiscount: boolean;
  /** Esconde os jogos que dependem da PS Plus (catálogo ou preço de assinante). */
  hidePlus: boolean;
  /** Esconde os jogos gratuitos. */
  hideFree: boolean;
  price: PriceRange | PriceRange[];
  /** Faixa digitada (mínimo e máximo); substitui as faixas prontas. */
  customPrice?: { min: number | null; max: number | null } | null;
  sort: StoreSort;
  /** Tipo de produto ("todos" ou lista vazia = sem filtro). */
  kind: "todos" | StoreKind | StoreKind[];
}

const asList = <T,>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);
/** Opções escolhidas de cada filtro (sem "todas"/"todos": lista vazia = sem filtro). */
export const selectedPlatforms = (f: StoreFilters) => asList(f.platform).filter((x): x is StorePlatform => x !== "todas");
export const selectedKinds = (f: StoreFilters) => asList(f.kind ?? "todos").filter((x): x is StoreKind => x !== "todos");
export const selectedPrices = (f: StoreFilters): PriceRange[] => [
  ...asList(f.price).filter((r) => r !== "todas"),
  ...(f.customPrice ? [f.customPrice] : []),
];

/** Limites das faixas de preço em cada moeda (em unidades, não centavos). */
const PRICE_STEPS: Record<StoreRegion, number[]> = {
  "pt-BR": [5, 10, 25, 50, 100, 150, 200, 250, 300, 400],
  "pt-PT": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "en-US": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "es-MX": [50, 100, 150, 300, 500, 700, 900, 1200, 1500, 1800],
  "es-AR": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "es-ES": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "fr-FR": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "de-DE": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "it-IT": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "en-GB": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "ja-JP": [300, 500, 1000, 2000, 3000, 4000, 5000, 7000, 9000],
  "en-CA": [2, 5, 10, 20, 30, 40, 50, 70, 90],
  "en-AU": [2, 5, 10, 20, 30, 50, 70, 90, 110],
  // Chile, Colômbia e Peru: a PlayStation Store cobra em dólar.
  "es-CL": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "es-CO": [2, 5, 10, 20, 30, 40, 50, 60, 80],
  "es-PE": [2, 5, 10, 20, 30, 40, 50, 60, 80],
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

export function inRange(p: StoreProduct, r: PriceRange): boolean {
  if (r === "todas") return true;
  if (r === "gratis") return p.isFree || p.price === 0;
  if (p.price === null || p.isFree || p.price === 0) return false;
  return (r.min === null || p.price >= r.min) && (r.max === null || p.price <= r.max);
}

/** Sem opção escolhida, passa tudo; com várias, basta uma servir. */
const anyOf = <T,>(list: T[], test: (x: T) => boolean) => list.length === 0 || list.some(test);

/** O produto passa nos filtros (menos o filtro `skip`, para contar as opções dele). */
function matches(p: StoreProduct, f: StoreFilters, skip?: "platform" | "kind" | "price"): boolean {
  const q = f.query.trim().toLowerCase();
  return (
    (!q || p.name.toLowerCase().includes(q)) &&
    (skip === "platform" || anyOf(selectedPlatforms(f), (x) => p.platforms.includes(x))) &&
    (!f.onlyDiscount || p.discount > 0) &&
    !(f.hidePlus && p.plus) &&
    !(f.hideFree && (p.isFree || p.price === 0)) &&
    (skip === "kind" || anyOf(selectedKinds(f), (k) => kindOf(p) === k)) &&
    (skip === "price" || anyOf(selectedPrices(f), (r) => inRange(p, r)))
  );
}

/**
 * Quantos produtos cada opção dos filtros mostraria (com os demais filtros
 * como estão), para mostrar a contagem e esconder as opções vazias.
 */
export function filterCounts(products: StoreProduct[], f: StoreFilters, region: StoreRegion) {
  const platform: Record<string, number> = { todas: 0, PS5: 0, PS4: 0 };
  const kind: Record<string, number> = { todos: 0 };
  const price: Record<string, number> = {};
  const ranges = priceRanges(region);
  for (const p of products) {
    if (matches(p, f, "platform")) {
      platform.todas++;
      for (const x of p.platforms) if (x in platform) platform[x]++;
    }
    if (matches(p, f, "kind")) {
      kind.todos++;
      const k = kindOf(p);
      kind[k] = (kind[k] ?? 0) + 1;
    }
    if (matches(p, f, "price")) for (const r of ranges) if (inRange(p, r.range)) price[r.key] = (price[r.key] ?? 0) + 1;
  }
  return { platform, kind, price };
}

export const isReleaseSort = (sort: StoreSort) => sort === "lancamento-novos" || sort === "lancamento-antigos";

/**
 * Aplica busca, filtros e ordenação (a ordem da loja é a de "mais vendidos").
 * `releaseOrder`: ids do mais novo ao mais antigo (storeReleaseOrder), para
 * ordenar por lançamento; sem ela, vale a data das imagens.
 */
export function filterProducts(products: StoreProduct[], f: StoreFilters, releaseOrder?: string[] | null): StoreProduct[] {
  const list = products.filter((p) => matches(p, f));
  const price = (p: StoreProduct) => p.price ?? Number.MAX_SAFE_INTEGER;
  if (isReleaseSort(f.sort)) {
    const rank = new Map((releaseOrder ?? []).map((id, i) => [id, i]));
    // Do mais novo ao mais antigo; o que a lista de lançamentos não tem vai pela data das imagens, no fim.
    const newest = [...list].sort(
      (a, b) =>
        (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) ||
        (b.imageDate ?? "").localeCompare(a.imageDate ?? ""),
    );
    return f.sort === "lancamento-novos" ? newest : newest.reverse();
  }
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
    "fr-FR": "EUR",
    "de-DE": "EUR",
    "it-IT": "EUR",
    "en-GB": "GBP",
    "ja-JP": "JPY",
    "en-CA": "CAD",
    "en-AU": "AUD",
    "es-CL": "USD",
    "es-CO": "USD",
    "es-PE": "USD",
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

/** Página do produto na loja, no país escolhido (as avaliações levam à página do jogo). */
export function productLink(p: StoreProduct, region: StoreRegion): string {
  return p.url
    ? p.url.replace(/store\.playstation\.com\/[a-z]{2}-[a-z]{2}\//, `store.playstation.com/${region.toLowerCase()}/`)
    : storeProductUrl(p.id, region);
}

/**
 * Avaliações da PS Plus Premium/Deluxe ("Game Trials"). A loja não tem uma
 * categoria pública com elas; a lista oficial fica na página de jogos da PS
 * Plus (playstation.com/…/ps-plus/games/), na seção "trials", com o link de
 * cada jogo na loja.
 */
export interface PlusTrial {
  conceptId: string;
  name: string;
  url: string;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** Lê as avaliações da página de jogos da PS Plus (vazia quando o país não lista nenhuma). */
export function parsePlusTrials(html: string): PlusTrial[] {
  const start = html.indexOf('id="trials"');
  if (start < 0) return [];
  const end = html.indexOf("</section>", start);
  const block = html.slice(start, end > 0 ? end : undefined);
  const out = new Map<string, PlusTrial>();
  for (const m of block.matchAll(/<a\s[^>]*href="(https:\/\/store\.playstation\.com\/[a-z-]+\/concept\/(\d+))"[^>]*>([^<]+)<\/a>/g)) {
    const name = decodeEntities(m[3]).trim();
    if (name && !out.has(m[2])) out.set(m[2], { conceptId: m[2], name, url: m[1] });
  }
  return [...out.values()];
}

/** Nome comparável entre a página da PS Plus e a loja ("CATAN® - Console Edition PS4™ & PS5®" = "CATAN Console Edition"). */
const trialKey = (name: string) =>
  withoutPlatforms(kindName(name))
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Cartões das avaliações: cada uma usa a imagem e as plataformas do jogo na
 * loja (quando o catálogo tem), não tem preço (vem com a assinatura) e abre a
 * página do jogo.
 */
export function plusTrialProducts(trials: PlusTrial[], catalog: StoreProduct[]): StoreProduct[] {
  const byName = new Map<string, StoreProduct>();
  for (const p of catalog) {
    const k = trialKey(p.name);
    const prev = byName.get(k);
    // O jogo completo vale mais que edições e pacotes de mesmo nome.
    if (!prev || (kindOf(prev) !== "jogo" && kindOf(p) === "jogo")) byName.set(k, p);
  }
  return trials.map((tr) => {
    const game = byName.get(trialKey(tr.name));
    return {
      id: `trial-${tr.conceptId}`,
      name: tr.name,
      imageUrl: game?.imageUrl ?? null,
      platforms: game?.platforms ?? [],
      basePriceText: null,
      priceText: null,
      basePrice: null,
      price: null,
      isFree: false,
      discount: 0,
      plus: true,
      classification: "TRIAL · Avaliação de jogo",
      kind: "avaliacao" as const,
      imageDate: game?.imageDate ?? null,
      url: tr.url,
    };
  });
}
