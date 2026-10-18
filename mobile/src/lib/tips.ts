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

/** Onde fica cada tipo de página nos sites: troféus e guias completos. */
const SITES: Record<GuideSite, { trophy: string; guide: string }> = {
  pst: { trophy: "playstationtrophies.org/game", guide: "playstationtrophies.org/game" },
  psnp: { trophy: "psnprofiles.com/trophy", guide: "psnprofiles.com/guide" },
};

/**
 * Guia escrito de um troféu. Os dois sites usam ids próprios nos endereços,
 * então a busca é restrita às páginas de troféu do site e usa os nomes
 * oficiais em inglês (como nos sites) do jogo e do troféu, entre aspas, para
 * achar exatamente aquele troféu daquele jogo, mais a plataforma.
 */
export function trophyWrittenGuideUrl(site: GuideSite, game: { name: string; platform: string }, trophyName: string): string {
  return google(
    `site:${SITES[site].trophy} "${guideGameName(game.name)}" "${clean(trophyName)}" ${mainPlatform(game.platform)}`.trim(),
  );
}

/** Guia completo do jogo (roteiro para a platina) no site escolhido. */
export function gameWrittenGuideUrl(site: GuideSite, game: { name: string; platform: string }): string {
  return google(`site:${SITES[site].guide} "${guideGameName(game.name)} Trophy Guide" ${mainPlatform(game.platform)}`.trim());
}
