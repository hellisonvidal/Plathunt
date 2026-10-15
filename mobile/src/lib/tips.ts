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
