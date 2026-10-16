import type { Settings } from "./settings";

const SUFFIX: Record<Settings["language"], string> = {
  "pt-BR": "troféu",
  "en-US": "trophy guide",
  "es-ES": "trofeo guía",
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
 * Guia escrito do troféu no PlayStationTrophies.org. O site usa ids próprios
 * nos endereços dos troféus, então a busca (restrita ao site) leva à página
 * certa pelo nome do jogo e do troféu, em inglês, como no site.
 */
export function trophyWrittenGuideUrl(gameName: string, trophyName: string): string {
  // Só o jogo vai entre aspas: se a Sony traduziu o troféu, o nome não bate exato com o site.
  const query = `site:playstationtrophies.org "${clean(gameName)}" ${clean(trophyName)} trophy`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Guia completo do jogo (roteiro para a platina) no PlayStationTrophies.org. */
export function gameWrittenGuideUrl(gameName: string): string {
  const query = `site:playstationtrophies.org "${clean(gameName)}" trophy guide road map`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
