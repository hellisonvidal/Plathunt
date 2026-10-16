import { getSettings, onSettingsChange, type Settings } from "./settings";

/**
 * Temas (Configurações → Aparência), com as cores dos personagens principais
 * de jogos de PlayStation. O id de cada tema não muda (fica salvo no celular).
 */
export const THEMES: { value: Settings["theme"]; label: string; description: string; swatch: [string, string, string] }[] = [
  { value: "playstation", label: "Astro Bot", description: "Branco do robô, preto do visor e azul dos olhos, o padrão", swatch: ["#f2f4f8", "#0b0d12", "#1463ff"] },
  { value: "light", label: "Gran Turismo", description: "Branco de pista com o vermelho do logo", swatch: ["#f5f5f5", "#ffffff", "#d0021b"] },
  { value: "oled", label: "Demon's Souls", description: "Preto puro (OLED) com o prata da armadura do Slayer", swatch: ["#000000", "#1c1c1c", "#b9c0ca"] },
  { value: "green", label: "The Last of Us", description: "Verde-oliva de Ellie com o cáqui de Joel", swatch: ["#13140c", "#282b1a", "#5e7a24"] },
  { value: "crimson", label: "God of War", description: "Cinza das cinzas de Kratos com a tatuagem vermelha", swatch: ["#171615", "#2e2b29", "#b3121f"] },
  { value: "purple", label: "Ratchet & Clank", description: "Pelo dourado de Ratchet sobre marrom", swatch: ["#1a1207", "#342411", "#e0a11b"] },
  { value: "spiderman", label: "Marvel's Spider-Man", description: "Azul do traje de Peter com o vermelho da máscara", swatch: ["#0b1238", "#1d2a6b", "#d01f2e"] },
  { value: "horizon", label: "Horizon", description: "Azul-petróleo do Focus com o ruivo de Aloy", swatch: ["#0a1a1f", "#173540", "#d9621b"] },
];

/** Aplica o tema no <html> e na cor da barra do sistema. */
export function applyTheme(theme: Settings["theme"] = getSettings().theme) {
  const root = document.documentElement;
  if (theme === "playstation") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // No Astro Bot as barras são pretas (o visor), então a barra do sistema também.
  const bg = theme === "playstation" ? "#0b0d12" : (THEMES.find((t) => t.value === theme)?.swatch[0] ?? "#0b0d12");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

/** Aplica o tema salvo e acompanha mudanças feitas nas Configurações. */
export function initTheme() {
  applyTheme();
  onSettingsChange(() => applyTheme());
}
