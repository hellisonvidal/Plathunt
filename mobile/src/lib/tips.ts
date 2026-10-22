import type { Settings } from "./settings";

const SUFFIX: Record<Settings["language"], string> = {
  "pt-BR": "troféu",
  "en-US": "trophy guide",
  "es-ES": "trofeo guía",
  "fr-FR": "trophée guide",
  "de-DE": "Trophäe Guide",
  "it-IT": "trofeo guida",
  "ja-JP": "トロフィー 攻略",
};

/**
 * Busca no YouTube um vídeo de dicas para o troféu: nome do jogo + nome do
 * troféu + "troféu"/"trophy guide" no idioma escolhido nas Configurações.
 */
export function trophyGuideUrl(gameName: string, trophyName: string, language: Settings["language"]): string {
  const query = [gameName, trophyName, SUFFIX[language]]
    .map((s) => s.replace(/[™®©]/g, "").trim())
    .filter(Boolean)
    .join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

const clean = (s: string) => s.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();

/**
 * Nome do jogo como nos sites de guias: sem ™/®, sem o "Trophies"/"Trophy Set"
 * que algumas listas antigas da PSN trazem no fim.
 */
export const guideGameName = (name: string) => clean(name).replace(/\s+(trophies|trophy set)$/i, "");

/** Plataforma principal da lista ("PS4,PSVITA" → "PS4"), para separar versões de PS4 e PS5. */
const mainPlatform = (platform: string) => (platform.split(",")[0] ?? "").replace("PSVITA", "PS Vita").trim();

const google = (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`;

export type GuideSite = "pst" | "psnp";

/**
 * Domínio de cada site. A busca filtra só pelo domínio: filtrar por um caminho
 * (site:psnprofiles.com/trophy) somado a nome do jogo entre aspas e plataforma
 * deixava a busca restritiva demais e o Google não achava nada.
 */
const SITES: Record<GuideSite, string> = {
  pst: "playstationtrophies.org",
  psnp: "psnprofiles.com",
};

/**
 * Guia escrito de um troféu: o nome oficial em inglês do troféu entre aspas
 * (como nos sites) e o nome do jogo, no site escolhido. Os dois sites usam ids
 * próprios nos endereços, por isso a busca. A plataforma não entra: ela quase
 * nunca aparece no texto das páginas de troféu.
 */
export function trophyWrittenGuideUrl(site: GuideSite, game: { name: string; platform: string }, trophyName: string): string {
  return google(`site:${SITES[site]} "${clean(trophyName)}" ${guideGameName(game.name)} trophy`);
}

/** Guia completo do jogo (roteiro para a platina) no site escolhido. */
export function gameWrittenGuideUrl(site: GuideSite, game: { name: string; platform: string }): string {
  return google(`site:${SITES[site]} ${guideGameName(game.name)} trophy guide ${mainPlatform(game.platform)}`.trim());
}
