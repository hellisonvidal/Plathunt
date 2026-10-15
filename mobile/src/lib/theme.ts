import { getSettings, onSettingsChange, type Settings } from "./settings";

/**
 * Temas (Configurações → Aparência), com nomes de jogos de PlayStation que
 * inspiram as cores. Cada tema escuro tem fundo e destaque de um matiz próprio.
 */
export const THEMES: { value: Settings["theme"]; label: string; description: string; swatch: [string, string, string] }[] = [
  { value: "playstation", label: "Astro Bot", description: "Azul-marinho com azul PlayStation, o padrão", swatch: ["#0b0f1a", "#131a2b", "#0070d1"] },
  { value: "light", label: "Gran Turismo", description: "Claro, branco de pista com azul", swatch: ["#f3f5f9", "#ffffff", "#0062c4"] },
  { value: "oled", label: "Demon's Souls", description: "Preto puro (OLED) com dourado", swatch: ["#000000", "#1c1c1c", "#e6b422"] },
  { value: "green", label: "The Last of Us", description: "Verde-escuro da vegetação", swatch: ["#06170f", "#133423", "#3fdc95"] },
  { value: "crimson", label: "God of War", description: "Vinho com vermelho de Kratos", swatch: ["#1c0709", "#3a1218", "#c62a3c"] },
  { value: "purple", label: "Ratchet & Clank", description: "Roxo profundo com lilás", swatch: ["#140a24", "#2a1946", "#7b3fe4"] },
  { value: "horizon", label: "Horizon", description: "Azul-petróleo com laranja de Aloy", swatch: ["#0a1a1f", "#173540", "#d9621b"] },
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
