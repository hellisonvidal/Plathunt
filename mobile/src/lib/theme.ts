import { getSettings, onSettingsChange, type Settings } from "./settings";

/**
 * Temas (Configurações → Aparência), inspirados nas cores de jogos famosos.
 * Os nomes só dão a dica do jogo (sem títulos nem personagens, que são marcas
 * de terceiros). O id de cada tema não muda (fica salvo no celular).
 */
export const THEMES: {
  value: Settings["theme"];
  label: string;
  description: string;
  /** Fundo, cartões e destaque. */
  swatch: [string, string, string];
  /** Cor das barras de cima e de baixo, quando diferente do fundo (ex.: Astro Bot). */
  bars?: string;
  /** Temas padrão (claro, escuro e automático); os outros são temas de jogos. */
  standard?: boolean;
}[] = [
  { value: "auto", label: "Automático", description: "Claro ou escuro, como o sistema do celular", swatch: ["#f5f6f8", "#0d0f13", "#2d7ff9"], standard: true },
  { value: "claro", label: "Claro", description: "Fundo claro com o azul clássico", swatch: ["#f5f6f8", "#ffffff", "#0070d1"], standard: true },
  { value: "escuro", label: "Escuro", description: "Fundo escuro com o azul clássico", swatch: ["#0d0f13", "#1f242c", "#2d7ff9"], standard: true },
  { value: "playstation", label: "Robozinho Azul", description: "Azul-céu, branco do robozinho, preto do visor e azul dos olhos", swatch: ["#bfd5fb", "#ffffff", "#0a6cff"], bars: "#0b0d12" },
  { value: "light", label: "Pista de Corrida", description: "Vermelho de bandeira de largada com o branco das faixas", swatch: ["#8c0013", "#b3001a", "#ffffff"] },
  { value: "oled", label: "Cavaleiro Sombrio", description: "Preto puro (OLED) com o prata de uma armadura antiga", swatch: ["#000000", "#1c1c1c", "#b9c0ca"] },
  { value: "green", label: "Mundo Pós-Apocalipse", description: "Verde-oliva da mata que tomou a cidade, com cáqui de sobrevivente", swatch: ["#13140c", "#282b1a", "#5e7a24"] },
  { value: "crimson", label: "Deus Espartano", description: "Cinza das cinzas com a tatuagem vermelha do guerreiro", swatch: ["#171615", "#2e2b29", "#b3121f"] },
  { value: "purple", label: "Mecânico Galáctico", description: "Pelo dourado de um mecânico das estrelas sobre marrom", swatch: ["#1a1207", "#342411", "#e0a11b"] },
  { value: "spiderman", label: "Herói Aracnídeo", description: "Azul do traje com o vermelho da máscara", swatch: ["#0b1238", "#1d2a6b", "#d01f2e"] },
  { value: "uncharted", label: "Caçador de Tesouros", description: "Bege de mapa antigo com verde de expedição", swatch: ["#efe6d2", "#faf5ea", "#3d5a2a"] },
  { value: "deathstranding", label: "Entregas no Fim do Mundo", description: "Claro e limpo, com detalhes em laranja", swatch: ["#f1f3f4", "#ffffff", "#c25400"] },
  { value: "horizon", label: "Caçadora de Máquinas", description: "Azul-petróleo com o ruivo da caçadora", swatch: ["#0a1a1f", "#173540", "#d9621b"] },
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

/** Modo escuro do sistema: o que o app Android informa ou, no navegador, prefers-color-scheme. */
function systemIsDark(): boolean {
  const fromApp = (window as { __tmSystemDark?: unknown }).__tmSystemDark;
  return typeof fromApp === "boolean" ? fromApp : !!darkQuery()?.matches;
}

/** "Automático" vira claro ou escuro conforme o sistema do aparelho. */
export function resolveTheme(theme: Settings["theme"], systemDark = typeof window !== "undefined" && systemIsDark()): Settings["theme"] {
  if (theme !== "auto") return theme;
  return systemDark ? "escuro" : "claro";
}

/** Aplica o tema no <html> e na cor da barra do sistema. */
export function applyTheme(chosen: Settings["theme"] = getSettings().theme) {
  const theme = resolveTheme(chosen);
  const root = document.documentElement;
  if (theme === "playstation") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  // Extras: se algum falhar num WebView diferente, o tema já está aplicado.
  try {
    publishRgbChannels(root);
    // No Astro Bot as barras são pretas (o visor), então a barra do sistema também.
    const bg = theme === "playstation" ? "#0b0d12" : (THEMES.find((t) => t.value === theme)?.swatch[0] ?? "#0b0d12");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  } catch (e) {
    console.error("Tema:", e);
  }
}

/** Aplica o tema salvo e acompanha mudanças feitas nas Configurações. */
export function initTheme() {
  // Os ouvintes vêm antes: mesmo que a primeira aplicação falhe, trocar o tema continua funcionando.
  const safeApply = () => {
    try {
      applyTheme();
    } catch (e) {
      console.error("Tema:", e);
    }
  };
  onSettingsChange(safeApply);
  // No automático, acompanha a troca de claro/escuro do sistema com o app aberto.
  const onSystemChange = () => {
    if (getSettings().theme === "auto") safeApply();
  };
  try {
    const query = darkQuery();
    if (query?.addEventListener) query.addEventListener("change", onSystemChange);
    else query?.addListener?.(onSystemChange);
    window.addEventListener("tm-system-theme", onSystemChange);
  } catch (e) {
    console.error("Tema:", e);
  }
  safeApply();
}
