import { cached } from "./cache";
import { gameWrittenGuideUrl, guideGameName, trophyWrittenGuideUrl, type GuideSite } from "./tips";

/**
 * Endereço direto dos guias escritos (a página do guia no próprio site, sem
 * passar por uma busca no Google). Os dois sites usam ids próprios nos
 * endereços, então o app lê as páginas deles para achar o link certo:
 *
 * - PlayStationTrophies: o endereço do jogo vem do nome
 *   (/game/god-of-war-ragnarok/guide/); o do troféu sai da lista de troféus.
 * - PSNProfiles: a busca do site dá o id do jogo; a página do jogo traz o
 *   link do guia e o de cada troféu.
 *
 * Só funciona no app (o Android faz as requisições, sem o bloqueio de CORS do
 * navegador). Se não der para ler o site (sem internet, proteção contra
 * robôs), abre o melhor palpite no próprio site; a busca no Google fica só
 * para quando o site responde que não tem o jogo.
 */

const PST = "https://www.playstationtrophies.org";
const PSNP = "https://psnprofiles.com";
const TIMEOUT_MS = 6000;
const DAY = 24 * 60 * 60 * 1000;

/** Só letras e números, sem acentos: para comparar nomes e trechos de endereço. */
export function guideKey(text: string): string {
  return safeDecode(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&#0?39;|&apos;/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Trecho de endereço do PlayStationTrophies a partir do nome ("Marvel's Spider-Man 2" → "marvels-spider-man-2"). */
export function pstSlugs(name: string): string[] {
  const base = guideGameName(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "");
  const slug = (s: string) => s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // "&" às vezes vira "and" no endereço, às vezes some.
  return [...new Set([slug(base), slug(base.replace(/&/g, " and "))])].filter(Boolean);
}

/**
 * Resultado de ler uma página: o HTML, "missing" quando o site diz que ela
 * não existe (404/410) ou "blocked" quando não deu para saber (sem internet,
 * tempo esgotado, proteção do site contra robôs…).
 */
type Page = { html: string } | "missing" | "blocked";

// Páginas já lidas nesta sessão (os troféus de um jogo usam a mesma página).
const pages = new Map<string, Promise<Page>>();

function getPage(url: string): Promise<Page> {
  let page = pages.get(url);
  if (!page) {
    page = loadPage(url);
    pages.set(url, page);
    // Não deu para ler: tenta de novo no próximo toque.
    void page.then((p) => p === "blocked" && pages.delete(url));
  }
  return page;
}

// Como um navegador de celular: alguns sites recusam pedidos sem esses cabeçalhos.
const HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
};

async function loadPage(url: string): Promise<Page> {
  // Sem AbortController: o fetch nativo do app (CapacitorHttp) não aceita `signal`.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"blocked">((resolve) => {
    timer = setTimeout(() => resolve("blocked"), TIMEOUT_MS);
  });
  const load = (async (): Promise<Page> => {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status === 404 || res.status === 410) return "missing";
      if (!res.ok) return "blocked";
      const html = await res.text();
      // Página de verificação contra robôs (Cloudflare) no lugar da página pedida.
      if (/cf-browser-verification|challenge-platform|Just a moment\.\.\./i.test(html)) return "blocked";
      return { html };
    } catch {
      return "blocked";
    }
  })();
  try {
    return await Promise.race([load, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Links (href) de uma página que casam com o padrão, sem repetição e na ordem da página. */
export function pageLinks(html: string, pattern: RegExp): string[] {
  const out: string[] = [];
  const re = /href=["']([^"'#?]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const href = m[1].replace(/^https?:\/\/[^/]+/, "");
    if (pattern.test(href) && !out.includes(href)) out.push(href);
  }
  return out;
}

/** O link de troféu cujo final ("123-nome-do-trofeu.html") casa com o nome do troféu. */
export function findTrophyLink(links: string[], trophyName: string): string | null {
  const want = guideKey(trophyName);
  if (!want) return null;
  return (
    links.find((href) => {
      const last = (href.split("/").filter(Boolean).pop() ?? "").replace(/\.html$/, "").replace(/^\d+-/, "");
      // Apóstrofos viram "039" no endereço do PlayStationTrophies.
      return guideKey(last) === want || guideKey(last.replace(/039/g, "")) === want;
    }) ?? null
  );
}

/**
 * Endereço achado (`url`), certeza de que o site não tem a página
 * ("missing", aí vale a busca no Google) ou o melhor palpite no próprio site
 * quando não deu para ler as páginas (`guess`, não fica guardado).
 */
type Found = { url: string } | { guess: string } | "missing";

// --- PlayStationTrophies ---

/** Lista de troféus do jogo no PlayStationTrophies (tenta cada forma do nome). */
async function pstGame(name: string): Promise<{ path: string; html: string } | "missing" | { blocked: string }> {
  const slugs = pstSlugs(name);
  if (!slugs.length) return "missing";
  let blocked = false;
  for (const slug of slugs) {
    const page = await getPage(`${PST}/game/${slug}/trophies/`);
    if (page === "blocked") blocked = true;
    // Jogo inexistente: o site responde 404 ou volta para outra página.
    else if (page !== "missing" && page.html.includes(`/game/${slug}/`)) return { path: `/game/${slug}`, html: page.html };
  }
  // Sem conseguir ler o site, o endereço montado pelo nome costuma estar certo.
  return blocked ? { blocked: `/game/${slugs[0]}` } : "missing";
}

async function pstGuide(name: string): Promise<Found> {
  const game = await pstGame(name);
  if (game === "missing") return "missing";
  if ("blocked" in game) return { guess: `${PST}${game.blocked}/guide/` };
  // Nem todo jogo tem o guia completo: aí fica a lista de troféus (com as dicas).
  return { url: game.html.includes(`${game.path}/guide/`) ? `${PST}${game.path}/guide/` : `${PST}${game.path}/trophies/` };
}

async function pstTrophy(name: string, trophyName: string): Promise<Found> {
  const game = await pstGame(name);
  if (game === "missing") return "missing";
  // Sem ler a lista não dá para saber o id do troféu: abre a lista do jogo.
  if ("blocked" in game) return { guess: `${PST}${game.blocked}/trophies/` };
  const links = pageLinks(game.html, new RegExp(`^${game.path}/trophy/[^/]+\\.html$`));
  const href = findTrophyLink(links, trophyName);
  return href ? { url: `${PST}${href}` } : { url: `${PST}${game.path}/trophies/` };
}

// --- PSNProfiles ---

/** Busca de jogos do próprio PSNProfiles (quando não dá para ler o site). */
const psnpSearch = (name: string) => `${PSNP}/search/games?q=${encodeURIComponent(guideGameName(name))}`;

async function psnpGame(name: string): Promise<{ path: string; html: string } | "missing" | "blocked"> {
  const search = await getPage(psnpSearch(name));
  if (search === "blocked") return "blocked";
  if (search === "missing") return "missing";
  const want = guideKey(guideGameName(name));
  const path = pageLinks(search.html, /^\/trophies\/\d+-[^/]+$/).find(
    (href) => guideKey(href.replace(/^\/trophies\/\d+-/, "")) === want,
  );
  if (!path) return "missing";
  const page = await getPage(`${PSNP}${path}`);
  if (page === "blocked") return "blocked";
  if (page === "missing") return "missing";
  return { path, html: page.html };
}

async function psnpGuide(name: string): Promise<Found> {
  const game = await psnpGame(name);
  if (game === "missing") return "missing";
  if (game === "blocked") return { guess: psnpSearch(name) };
  const guide = pageLinks(game.html, /^\/guide\/\d+-[^/]+$/)[0];
  return { url: guide ? `${PSNP}${guide}` : `${PSNP}${game.path}` };
}

async function psnpTrophy(name: string, trophyName: string): Promise<Found> {
  const game = await psnpGame(name);
  if (game === "missing") return "missing";
  if (game === "blocked") return { guess: psnpSearch(name) };
  const id = game.path.replace(/^\/trophies\//, "");
  const links = pageLinks(game.html, new RegExp(`^/trophy/${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/\\d+-[^/]+$`));
  const href = findTrophyLink(links, trophyName);
  return { url: href ? `${PSNP}${href}` : `${PSNP}${game.path}` };
}

/**
 * Endereço do guia: o achado (guardado por 30 dias), o palpite no próprio site
 * quando não deu para ler as páginas, ou `null` quando o site não tem a página.
 */
async function resolve(key: string, find: () => Promise<Found>): Promise<string | null> {
  let guess: string | null = null;
  try {
    return await cached(key, 30 * DAY, async () => {
      const found = await find();
      if (found === "missing") throw new Error("guia não encontrado");
      if ("guess" in found) {
        guess = found.guess;
        throw new Error("site sem resposta");
      }
      return found.url;
    });
  } catch {
    return guess;
  }
}

/** Guia completo do jogo: direto no site; a busca no Google só se o site não tiver o jogo. */
export async function resolveGameGuide(site: GuideSite, game: { name: string; platform: string }): Promise<string> {
  const url = await resolve(`guide-link:${site}:${guideKey(game.name)}`, () =>
    site === "pst" ? pstGuide(game.name) : psnpGuide(game.name),
  );
  return url ?? gameWrittenGuideUrl(site, game);
}

/** Página do troféu no site (com as dicas); a busca no Google só se o site não tiver o jogo. */
export async function resolveTrophyGuide(
  site: GuideSite,
  game: { name: string; platform: string },
  trophyName: string,
): Promise<string> {
  const url = await resolve(`guide-link:${site}:${guideKey(game.name)}:${guideKey(trophyName)}`, () =>
    site === "pst" ? pstTrophy(game.name, trophyName) : psnpTrophy(game.name, trophyName),
  );
  return url ?? trophyWrittenGuideUrl(site, game, trophyName);
}
