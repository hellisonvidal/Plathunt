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
 * navegador). Se o site mudar, recusar ou não tiver o jogo, vale a busca no
 * Google de antes.
 */

const PST = "https://www.playstationtrophies.org";
const PSNP = "https://psnprofiles.com";
const TIMEOUT_MS = 8000;
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

// Páginas já lidas nesta sessão (os troféus de um jogo usam a mesma página).
const pages = new Map<string, Promise<{ url: string; html: string } | null>>();

function getPage(url: string): Promise<{ url: string; html: string } | null> {
  let page = pages.get(url);
  if (!page) {
    page = loadPage(url);
    pages.set(url, page);
    // Falhou: tenta de novo no próximo toque.
    void page.then((p) => p || pages.delete(url));
  }
  return page;
}

async function loadPage(url: string): Promise<{ url: string; html: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "text/html" } });
    if (!res.ok) return null;
    return { url: res.url || url, html: await res.text() };
  } catch {
    return null;
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

// --- PlayStationTrophies ---

async function pstGamePath(name: string): Promise<{ path: string; html: string } | null> {
  for (const slug of pstSlugs(name)) {
    const page = await getPage(`${PST}/game/${slug}/trophies/`);
    // Jogo inexistente: o site responde com erro ou volta para a página inicial.
    if (page && page.html.includes(`/game/${slug}/`)) return { path: `/game/${slug}`, html: page.html };
  }
  return null;
}

async function pstGuide(name: string): Promise<string | null> {
  const game = await pstGamePath(name);
  if (!game) return null;
  // Nem todo jogo tem o guia completo: aí fica a lista de troféus (com as dicas).
  return game.html.includes(`${game.path}/guide/`) ? `${PST}${game.path}/guide/` : `${PST}${game.path}/trophies/`;
}

async function pstTrophy(name: string, trophyName: string): Promise<string | null> {
  const game = await pstGamePath(name);
  if (!game) return null;
  const links = pageLinks(game.html, new RegExp(`^${game.path}/trophy/[^/]+\\.html$`));
  const href = findTrophyLink(links, trophyName);
  return href ? `${PST}${href}` : null;
}

// --- PSNProfiles ---

async function psnpGame(name: string): Promise<{ path: string; html: string } | null> {
  const search = await getPage(`${PSNP}/search/games?q=${encodeURIComponent(guideGameName(name))}`);
  if (!search) return null;
  const want = guideKey(guideGameName(name));
  const path = pageLinks(search.html, /^\/trophies\/\d+-[^/]+$/).find(
    (href) => guideKey(href.replace(/^\/trophies\/\d+-/, "")) === want,
  );
  if (!path) return null;
  const page = await getPage(`${PSNP}${path}`);
  return page ? { path, html: page.html } : null;
}

async function psnpGuide(name: string): Promise<string | null> {
  const game = await psnpGame(name);
  if (!game) return null;
  const guide = pageLinks(game.html, /^\/guide\/\d+-[^/]+$/)[0];
  return guide ? `${PSNP}${guide}` : `${PSNP}${game.path}`;
}

async function psnpTrophy(name: string, trophyName: string): Promise<string | null> {
  const game = await psnpGame(name);
  if (!game) return null;
  const id = game.path.replace(/^\/trophies\//, "");
  const links = pageLinks(game.html, new RegExp(`^/trophy/${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/\\d+-[^/]+$`));
  const href = findTrophyLink(links, trophyName);
  return href ? `${PSNP}${href}` : null;
}

/** Guarda só os endereços achados: sem endereço (ou com erro), tenta de novo da próxima vez. */
function remember(key: string, find: () => Promise<string | null>): Promise<string | null> {
  return cached(key, 30 * DAY, async () => {
    const url = await find();
    if (!url) throw new Error("guia não encontrado");
    return url;
  }).catch(() => null);
}

/** Guia completo do jogo: o endereço direto ou, sem ele, a busca no Google. */
export async function resolveGameGuide(site: GuideSite, game: { name: string; platform: string }): Promise<string> {
  const direct = await remember(`guide-link:${site}:${guideKey(game.name)}`, () =>
    site === "pst" ? pstGuide(game.name) : psnpGuide(game.name),
  );
  return direct ?? gameWrittenGuideUrl(site, game);
}

/** Página do troféu no site (com as dicas): o endereço direto ou, sem ele, a busca no Google. */
export async function resolveTrophyGuide(
  site: GuideSite,
  game: { name: string; platform: string },
  trophyName: string,
): Promise<string> {
  const direct = await remember(`guide-link:${site}:${guideKey(game.name)}:${guideKey(trophyName)}`, () =>
    site === "pst" ? pstTrophy(game.name, trophyName) : psnpTrophy(game.name, trophyName),
  );
  return direct ?? trophyWrittenGuideUrl(site, game, trophyName);
}
