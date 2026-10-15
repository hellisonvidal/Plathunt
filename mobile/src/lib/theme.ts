import { getSettings, onSettingsChange, type Settings } from "./settings";

export const THEMES: { value: Settings["theme"]; label: string; description: string; swatch: [string, string, string] }[] = [
  { value: "playstation", label: "PlayStation", description: "Azul-marinho, o padrão", swatch: ["#0b0f1a", "#131a2b", "#0070d1"] },
  { value: "light", label: "Claro", description: "Fundo claro para usar de dia", swatch: ["#f3f5f9", "#ffffff", "#0062c4"] },
  { value: "oled", label: "Preto OLED", description: "Preto puro, economiza bateria", swatch: ["#000000", "#0d0d0d", "#0070d1"] },
  { value: "graphite", label: "Grafite", description: "Cinza grafite com ciano", swatch: ["#16191d", "#1f2328", "#0a7e95"] },
  { value: "crimson", label: "Carmesim", description: "Escuro com vermelho do botão ○", swatch: ["#120b0d", "#1e1416", "#b82a38"] },
];

/** Aplica o tema no <html> e na cor da barra do sistema. */
export function applyTheme(theme: Settings["theme"] = getSettings().theme) {
  const root = document.documentElement;
  if (theme === "playstation") delete root.dataset.theme;
  else root.dataset.theme = theme;
  const bg = THEMES.find((t) => t.value === theme)?.swatch[0] ?? "#0b0f1a";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

/** Aplica o tema salvo e acompanha mudanças feitas nas Configurações. */
export function initTheme() {
  applyTheme();
  onSettingsChange(() => applyTheme());
}
