import { getSettings, onSettingsChange, type Settings } from "./settings";

/**
 * Temas (Configurações → Aparência), com as cores dos personagens principais
 * de jogos de PlayStation. O id de cada tema não muda (fica salvo no celular).
 */
export const THEMES: {
  value: Settings["theme"];
  label: string;
  description: string;
  swatch: [string, string, string];
  /** Temas padrão (claro, escuro e automático); os outros são temas de jogos. */
  standard?: boolean;
}[] = [
  { value: "auto", label: "Automático", description: "Claro ou escuro, como o sistema do celular", swatch: ["#f5f6f8", "#0d0f13", "#2d7ff9"], standard: true },
  { value: "claro", label: "Claro", description: "Fundo claro com o azul PlayStation", swatch: ["#f5f6f8", "#ffffff", "#0070d1"], standard: true },
  { value: "escuro", label: "Escuro", description: "Fundo escuro com o azul PlayStation", swatch: ["#0d0f13", "#1f242c", "#2d7ff9"], standard: true },
  { value: "playstation", label: "Astro Bot", description: "Branco do robô, preto do visor e azul dos olhos", swatch: ["#f2f4f8", "#0b0d12", "#1463ff"] },
  { value: "light", label: "Gran Turismo", description: "Vermelho do logo com branco de pista", swatch: ["#8c0013", "#b3001a", "#ffffff"] },
  { value: "oled", label: "Demon's Souls", description: "Preto puro (OLED) com o prata da armadura do Slayer", swatch: ["#000000", "#1c1c1c", "#b9c0ca"] },
  { value: "green", label: "The Last of Us", description: "Verde-oliva de Ellie com o cáqui de Joel", swatch: ["#13140c", "#282b1a", "#5e7a24"] },
  { value: "crimson", label: "God of War", description: "Cinza das cinzas de Kratos com a tatuagem vermelha", swatch: ["#171615", "#2e2b29", "#b3121f"] },
  { value: "purple", label: "Ratchet & Clank", description: "Pelo dourado de Ratchet sobre marrom", swatch: ["#1a1207", "#342411", "#e0a11b"] },
  { value: "spiderman", label: "Marvel's Spider-Man", description: "Azul do traje de Peter com o vermelho da máscara", swatch: ["#0b1238", "#1d2a6b", "#d01f2e"] },
  { value: "uncharted", label: "Uncharted", description: "Bege de mapa antigo com verde militar", swatch: ["#efe6d2", "#faf5ea", "#3d5a2a"] },
  { value: "deathstranding", label: "Death Stranding", description: "Claro como a Bridges, com detalhes em laranja", swatch: ["#f1f3f4", "#ffffff", "#c25400"] },
  { value: "horizon", label: "Horizon", description: "Azul-petróleo do Focus com o ruivo de Aloy", swatch: ["#0a1a1f", "#173540", "#d9621b"] },
];

/** Cores do tema que também são usadas com transparência (ex.: bg-bg/95). */
export const THEME_COLORS = [
  "bg",
  "surface",
  "surface-2",
  "line",
  "ink",
  "muted",
  "ps-blue",
  "ps-blue-2",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "on-accent",
] as const;

/** "#0b0f1a", "#fff" ou "rgb(1, 2, 3)" → "11 15 26" (formato de rgb(var() / alfa)). */
export function toRgbChannels(color: string): string | null {
  const c = color.trim();
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((h) => h + h).join("") : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(" ");
  }
  const rgb = c.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  return rgb ? `${rgb[1]} ${rgb[2]} ${rgb[3]}` : null;
}

/**
 * As cores com transparência do Tailwind (bg-bg/95, border-gold/40…) só seguem
 * o tema em WebViews com color-mix(in lab) (Chrome 111+); nos mais antigos
 * ficam com a cor fixa do tema padrão. Por isso o app publica cada cor do tema
 * também em canais RGB (--rgb-*), usados pelas regras de styles.css.
 */
function publishRgbChannels(root: HTMLElement) {
  const computed = getComputedStyle(root);
  for (const name of THEME_COLORS) {
    const channels = toRgbChannels(computed.getPropertyValue(`--color-${name}`));
    if (channels) root.style.setProperty(`--rgb-${name}`, channels);
  }
}

const darkQuery = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

/** "Automático" vira claro ou escuro conforme o sistema do aparelho. */
export function resolveTheme(theme: Settings["theme"], systemDark = !!darkQuery()?.matches): Settings["theme"] {
  if (theme !== "auto") return theme;
  return systemDark ? "escuro" : "claro";
}

/** Aplica o tema no <html> e na cor da barra do sistema. */
export function applyTheme(chosen: Settings["theme"] = getSettings().theme) {
  const theme = resolveTheme(chosen);
  const root = document.documentElement;
  if (theme === "playstation") delete root.dataset.theme;
  else root.dataset.theme = theme;
  publishRgbChannels(root);
  // No Astro Bot as barras são pretas (o visor), então a barra do sistema também.
  const bg = theme === "playstation" ? "#0b0d12" : (THEMES.find((t) => t.value === theme)?.swatch[0] ?? "#0b0d12");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

/** Aplica o tema salvo e acompanha mudanças feitas nas Configurações. */
export function initTheme() {
  applyTheme();
  onSettingsChange(() => applyTheme());
  // No automático, acompanha a troca de claro/escuro do sistema com o app aberto.
  const query = darkQuery();
  const onSystemChange = () => {
    if (getSettings().theme === "auto") applyTheme();
  };
  if (query?.addEventListener) query.addEventListener("change", onSystemChange);
  else query?.addListener?.(onSystemChange);
}
