/** Ícones da barra de abas (traço, herdam a cor do texto). */
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-6 w-6",
  "aria-hidden": true,
};

export const ProfileIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);

export const StatsIcon = () => (
  <svg {...base}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const FriendsIcon = () => (
  <svg {...base}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" />
    <circle cx="17" cy="9" r="2.8" />
    <path d="M16.5 14.5c2.6.2 4.3 2 5 4.8" />
  </svg>
);

/** Controle no estilo PlayStation, com os quatro botões △ ○ ✕ □. */
export const ControllerIcon = () => (
  <svg {...base} viewBox="0 0 28 24" className="h-6 w-7">
    <path d="M8 6h12c2.6 0 4.3 1.6 5 4.4l1.6 6.6c.5 2.2-1.2 4.1-3.2 3.4-1.5-.5-2.4-2-3.4-3.4h-12c-1 1.4-1.9 2.9-3.4 3.4-2 .7-3.7-1.2-3.2-3.4L3 10.4C3.7 7.6 5.4 6 8 6Z" />
    <path d="M8 10.5v3M6.5 12h3" />
    <path d="m19.6 9.6.9 1.4h-1.8Z" strokeWidth="1.2" />
    <circle cx="21.6" cy="12.3" r=".8" strokeWidth="1.2" />
    <path d="m19.1 13.5 1 1m0-1-1 1" strokeWidth="1.2" />
    <rect x="16.9" y="11.6" width="1.4" height="1.4" strokeWidth="1.2" />
  </svg>
);

export const RankingIcon = () => (
  <svg {...base}>
    <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.5M17 6h2.5a2.5 2.5 0 0 1-2.6 3.5M12 13v4M8 21h8M9.5 17h5v4h-5Z" />
  </svg>
);

export const SettingsIcon = () => (
  <svg {...base} className="h-5 w-5">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

/** Selo do PlayStation Plus: "+" amarelo. */
export const PsPlusIcon = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }} aria-label="PlayStation Plus" role="img">
    <defs>
      <linearGradient id="psplus-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffe066" />
        <stop offset="1" stopColor="#e3a300" />
      </linearGradient>
    </defs>
    <path
      d="M9 2.5h6a1 1 0 0 1 1 1V8h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H16v4.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V16H3.5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1H8V3.5a1 1 0 0 1 1-1Z"
      fill="url(#psplus-g)"
      stroke="#9a6b00"
      strokeWidth="0.8"
    />
  </svg>
);

/** Símbolos dos botões do controle PlayStation, nas cores clássicas. */
export const PS_BUTTONS = {
  "ps:triangle": { glyph: "△", color: "#3ed3a2", label: "Triângulo" },
  "ps:circle": { glyph: "○", color: "#ff5a6e", label: "Círculo" },
  "ps:cross": { glyph: "✕", color: "#7aa8ff", label: "Xis" },
  "ps:square": { glyph: "□", color: "#f08fd6", label: "Quadrado" },
} as const;
