import { getSettings, onSettingsChange, type Settings } from "./settings";

/**
 * Temas (Configurações → Aparência). Cada tema escuro tem fundo e destaque de
 * um matiz diferente, inspirados nos botões do controle (✕ ○ △ □).
 */
export const THEMES: { value: Settings["theme"]; label: string; description: string; swatch: [string, string, string] }[] = [
  { value: "playstation", label: "PlayStation", description: "Azul-marinho com azul ✕, o padrão", swatch: ["#0b0f1a", "#131a2b", "#0070d1"] },
  { value: "light", label: "Claro", description: "Fundo claro para usar de dia", swatch: ["#f3f5f9", "#ffffff", "#0062c4"] },
  { value: "oled", label: "Preto e ouro", description: "Preto puro (OLED) com dourado de platina", swatch: ["#000000", "#1c1c1c", "#e6b422"] },
  { value: "green", label: "Verde △", description: "Verde-escuro com destaque verde", swatch: ["#06170f", "#133423", "#3fdc95"] },
  { value: "crimson", label: "Vermelho ○", description: "Vinho com destaque vermelho", swatch: ["#1c0709", "#3a1218", "#c62a3c"] },
  { value: "purple", label: "Roxo □", description: "Roxo profundo com lilás", swatch: ["#140a24", "#2a1946", "#7b3fe4"] },
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
