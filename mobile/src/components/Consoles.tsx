import { useId } from "react";

/**
 * Ilustrações 2D dos controles de cada console para o menu "Plataformas
 * jogadas": DualSense (PS5), DualShock 4 (PS4), DualShock 3 (PS3), o PS Vita
 * (que é o próprio controle) e o DualShock cinza clássico para "Todas". As
 * cores são as dos controles; o quadradinho tem fundo claro neutro, para
 * ficarem bonitos em qualquer tema.
 */

/** Prefixo único por desenho: os gradientes de vários desenhos não se misturam. */
const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, "");

/** DualSense (PS5). */
function Ps5() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}dw`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#d3d9e3"/></linearGradient>
        <linearGradient id={`${u}dk`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a2f3a"/><stop offset="1" stopColor="#0b0d12"/></linearGradient>
        <radialGradient id={`${u}dsh`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" stopOpacity="0.3"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
        <radialGradient id={`${u}dst`} cx="0.4" cy="0.35" r="0.6"><stop offset="0" stopColor="#4a505c"/><stop offset="1" stopColor="#0b0d12"/></radialGradient>
      </defs>
      <ellipse cx="48" cy="80" rx="38" ry="4" fill={`url(#${u}dsh)`}/>
      <path d="M26 26 h44 c9 0 14 6 16 14 l5 20 c2 9 -5 15 -12 12 c-5 -2 -8 -8 -11 -12 h-40 c-3 4 -6 10 -11 12 c-7 3 -14 -3 -12 -12 l5 -20 c2 -8 7 -14 16 -14 Z" fill={`url(#${u}dw)`} stroke="#aab3c2" strokeWidth="0.8"/>
      <path d="M30 44 h36 l-4 14 h-28 Z" fill={`url(#${u}dk)`}/>
      <rect x="36" y="27" width="24" height="12" rx="3" fill="#e7ebf1" stroke="#c4ccd8" strokeWidth="0.8"/>
      <path d="M38 27.5 h20" stroke="#4d9bff" strokeWidth="1.4" strokeLinecap="round"/>
      <g stroke="#2a2f3a" strokeWidth="2.4" strokeLinecap="round"><path d="M17 40 h10 M22 35 v10"/></g>
      <circle cx="37" cy="52" r="4.5" fill={`url(#${u}dst)`}/>
      <circle cx="59" cy="52" r="4.5" fill={`url(#${u}dst)`}/>
      <g fill="none" strokeWidth="1.6">
        <path d="M74 31 l 2.6 4.2 h -5.2 Z" stroke="#2a8f6a"/>
        <circle cx="80.5" cy="39" r="2.2" stroke="#d6453d"/>
        <path d="M72.4 44.4 l 3.2 3.2 m 0 -3.2 l -3.2 3.2" stroke="#3a6fd8"/>
        <rect x="65.8" y="36.8" width="4.4" height="4.4" stroke="#c561b8"/>
      </g>
    </svg>
  );
}

/** DualShock 4 (PS4). */
function Ps4() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}d4b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a404c"/><stop offset="0.45" stopColor="#1a1d24"/><stop offset="1" stopColor="#0a0b0e"/></linearGradient>
        <linearGradient id={`${u}d4t`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c313b"/><stop offset="1" stopColor="#15181e"/></linearGradient>
        <radialGradient id={`${u}d4st`} cx="0.4" cy="0.35" r="0.6"><stop offset="0" stopColor="#5b6270"/><stop offset="1" stopColor="#14171d"/></radialGradient>
        <radialGradient id={`${u}d4sh`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" stopOpacity="0.3"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
        <filter id={`${u}d4glow`} x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="1.4"/></filter>
      </defs>
      <ellipse cx="48" cy="80" rx="38" ry="4" fill={`url(#${u}d4sh)`}/>
      <path d="M38 28.5 h20" stroke="#4d9bff" strokeWidth="4" filter={`url(#${u}d4glow)`}/>
      <path d="M24 28 h48 c8 0 13 5 15 13 l5 19 c2 9 -5 15 -12 12 c-5 -2 -9 -8 -12 -12 h-38 c-3 4 -7 10 -12 12 c-7 3 -14 -3 -12 -12 l5 -19 c2 -8 7 -13 15 -13 Z" fill={`url(#${u}d4b)`} stroke="#4a5160" strokeWidth="0.8"/>
      <path d="M22 34 C 30 30, 66 30, 74 34" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.25" strokeLinecap="round"/>
      <rect x="35" y="29" width="26" height="14" rx="3" fill={`url(#${u}d4t)`} stroke="#3a404c" strokeWidth="0.8"/>
      <path d="M38 28.6 h20" stroke="#b5d6ff" strokeWidth="1.4" strokeLinecap="round"/>
      <g stroke="#9aa3b2" strokeWidth="2.4" strokeLinecap="round"><path d="M16 42 h10 M21 37 v10"/></g>
      <circle cx="36" cy="54" r="4.8" fill={`url(#${u}d4st)`} stroke="#4a5160" strokeWidth="0.6"/>
      <circle cx="60" cy="54" r="4.8" fill={`url(#${u}d4st)`} stroke="#4a5160" strokeWidth="0.6"/>
      <circle cx="48" cy="52" r="1.8" fill="#2c313b" stroke="#5b6270" strokeWidth="0.6"/>
      <g fill="none" strokeWidth="1.6">
        <path d="M75 33 l 2.6 4.2 h -5.2 Z" stroke="#3fd39a"/>
        <circle cx="81.5" cy="41" r="2.2" stroke="#ff6b63"/>
        <path d="M73.4 46.4 l 3.2 3.2 m 0 -3.2 l -3.2 3.2" stroke="#7aa8ff"/>
        <rect x="66.8" y="38.8" width="4.4" height="4.4" stroke="#ee8de2"/>
      </g>
    </svg>
  );
}

/** DualShock 3 (PS3). */
function Ps3() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}d3b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a505c"/><stop offset="0.35" stopColor="#1c1f26"/><stop offset="1" stopColor="#08090c"/></linearGradient>
        <radialGradient id={`${u}d3st`} cx="0.4" cy="0.35" r="0.6"><stop offset="0" stopColor="#5b6270"/><stop offset="1" stopColor="#14171d"/></radialGradient>
        <radialGradient id={`${u}d3sh`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" stopOpacity="0.3"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="48" cy="80" rx="38" ry="4" fill={`url(#${u}d3sh)`}/>
      <path d="M22 30 h52 c7 0 11 4 13 11 l6 22 c2 8 -4 13 -10 11 c-5 -1.5 -8 -7 -11 -12 h-48 c-3 5 -6 10.5 -11 12 c-6 2 -12 -3 -10 -11 l6 -22 c2 -7 6 -11 13 -11 Z" fill={`url(#${u}d3b)`} stroke="#5a6170" strokeWidth="0.8"/>
      <path d="M20 36 C 30 32, 66 32, 76 36" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.35" strokeLinecap="round"/>
      <g stroke="#9aa3b2" strokeWidth="2.6" strokeLinecap="round"><path d="M14 44 h11 M19.5 38.5 v11"/></g>
      <circle cx="36" cy="56" r="5" fill={`url(#${u}d3st)`} stroke="#5a6170" strokeWidth="0.6"/>
      <circle cx="60" cy="56" r="5" fill={`url(#${u}d3st)`} stroke="#5a6170" strokeWidth="0.6"/>
      <rect x="38" y="42" width="6" height="2" rx="1" fill="#5b6270"/>
      <path d="M52 41.5 l 5 1.5 l -5 1.5 Z" fill="#5b6270"/>
      <circle cx="48" cy="49" r="2.6" fill="#1b1e24" stroke="#9aa3b2" strokeWidth="0.7"/>
      <g strokeWidth="0">
        <circle cx="77" cy="36.5" r="3.2" fill="#2a2f3a"/><circle cx="83.5" cy="43" r="3.2" fill="#2a2f3a"/>
        <circle cx="77" cy="49.5" r="3.2" fill="#2a2f3a"/><circle cx="70.5" cy="43" r="3.2" fill="#2a2f3a"/>
      </g>
      <g fill="none" strokeWidth="1.3">
        <path d="M77 34.6 l 1.9 3.1 h -3.8 Z" stroke="#3fd39a"/>
        <circle cx="83.5" cy="43" r="1.6" stroke="#ff6b63"/>
        <path d="M75.6 48.1 l 2.8 2.8 m 0 -2.8 l -2.8 2.8" stroke="#7aa8ff"/>
        <rect x="69" y="41.5" width="3" height="3" stroke="#ee8de2"/>
      </g>
    </svg>
  );
}

/** PS Vita: o próprio portátil é o controle. */
function Vita() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}vb`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a404c"/><stop offset="0.5" stopColor="#16191f"/><stop offset="1" stopColor="#0a0b0e"/></linearGradient>
        <linearGradient id={`${u}vs`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1e5bd8"/><stop offset="1" stopColor="#0a1f55"/></linearGradient>
        <linearGradient id={`${u}vr`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.35"/><stop offset="0.5" stopColor="#ffffff" stopOpacity="0"/></linearGradient>
        <radialGradient id={`${u}vst`} cx="0.4" cy="0.35" r="0.6"><stop offset="0" stopColor="#5b6270"/><stop offset="1" stopColor="#1b1e24"/></radialGradient>
        <radialGradient id={`${u}vsh`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" stopOpacity="0.35"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="48" cy="70" rx="42" ry="5" fill={`url(#${u}vsh)`}/>
      <rect x="4" y="30" width="88" height="38" rx="19" fill={`url(#${u}vb)`} stroke="#5a6170" strokeWidth="0.8"/>
      <rect x="28" y="34" width="40" height="30" rx="3" fill="#050608"/>
      <rect x="30" y="36" width="36" height="26" rx="2" fill={`url(#${u}vs)`}/>
      <path d="M30 36 h 22 l -14 26 h -8 Z" fill={`url(#${u}vr)`}/>
      <g stroke="#c9ced8" strokeWidth="2.2" strokeLinecap="round"><path d="M12 42 h8 M16 38 v8"/></g>
      <circle cx="16" cy="56" r="4" fill={`url(#${u}vst)`} stroke="#6a7384" strokeWidth="0.8"/>
      <circle cx="80" cy="56" r="4" fill={`url(#${u}vst)`} stroke="#6a7384" strokeWidth="0.8"/>
      <g fill="none" strokeWidth="1.4">
        <path d="M80 35.5 l 2.2 3.6 h -4.4 Z" stroke="#3fd39a"/>
        <circle cx="85" cy="42" r="1.9" stroke="#ff6b63"/>
        <path d="M78.6 46.6 l 2.8 2.8 m 0 -2.8 l -2.8 2.8" stroke="#7aa8ff"/>
        <rect x="73.2" y="40.2" width="3.6" height="3.6" stroke="#ee8de2"/>
      </g>
    </svg>
  );
}

/** DualShock cinza clássico (todas as plataformas). */
function AllConsoles() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}d1b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e3e6ea"/><stop offset="1" stopColor="#b9bec6"/></linearGradient>
        <linearGradient id={`${u}d1g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a7adb7"/><stop offset="1" stopColor="#7d838d"/></linearGradient>
        <radialGradient id={`${u}d1st`} cx="0.4" cy="0.35" r="0.6"><stop offset="0" stopColor="#5b6270"/><stop offset="1" stopColor="#1b1e24"/></radialGradient>
        <radialGradient id={`${u}d1sh`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" stopOpacity="0.28"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="48" cy="80" rx="38" ry="4" fill={`url(#${u}d1sh)`}/>
      <path d="M22 30 h52 c7 0 11 4 13 11 l6 22 c2 8 -4 13 -10 11 c-5 -1.5 -8 -7 -11 -12 h-48 c-3 5 -6 10.5 -11 12 c-6 2 -12 -3 -10 -11 l6 -22 c2 -7 6 -11 13 -11 Z" fill={`url(#${u}d1b)`} stroke="#8a919c" strokeWidth="0.8"/>
      <path d="M9 54 l 4 -13 c 2 -7 6 -11 13 -11 h4 c-6 2 -10 8 -12 16 l -3 14 Z" fill={`url(#${u}d1g)`} opacity="0.55"/>
      <path d="M87 54 l -4 -13 c -2 -7 -6 -11 -13 -11 h-4 c6 2 10 8 12 16 l 3 14 Z" fill={`url(#${u}d1g)`} opacity="0.55"/>
      <path d="M20 35 C 30 32, 66 32, 76 35" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.8" strokeLinecap="round"/>
      <g stroke="#5b6270" strokeWidth="2.6" strokeLinecap="round"><path d="M14 44 h11 M19.5 38.5 v11"/></g>
      <circle cx="36" cy="56" r="5" fill={`url(#${u}d1st)`}/>
      <circle cx="60" cy="56" r="5" fill={`url(#${u}d1st)`}/>
      <rect x="38" y="43" width="6" height="2" rx="1" fill="#6b727e"/>
      <rect x="52" y="43" width="6" height="2" rx="1" fill="#6b727e"/>
      <g strokeWidth="0">
        <circle cx="77" cy="36.5" r="3.2" fill="#8a919c"/><circle cx="83.5" cy="43" r="3.2" fill="#8a919c"/>
        <circle cx="77" cy="49.5" r="3.2" fill="#8a919c"/><circle cx="70.5" cy="43" r="3.2" fill="#8a919c"/>
      </g>
      <g fill="none" strokeWidth="1.3">
        <path d="M77 34.6 l 1.9 3.1 h -3.8 Z" stroke="#1f9e6e"/>
        <circle cx="83.5" cy="43" r="1.6" stroke="#e0433b"/>
        <path d="M75.6 48.1 l 2.8 2.8 m 0 -2.8 l -2.8 2.8" stroke="#3a6fd8"/>
        <rect x="69" y="41.5" width="3" height="3" stroke="#c561b8"/>
      </g>
    </svg>
  );
}

const DRAWINGS: Record<string, () => React.ReactElement> = {
  PS5: Ps5,
  PS4: Ps4,
  PS3: Ps3,
  "PS Vita": Vita,
};

/** Imagem 2D do controle da plataforma (null = todas). */
export function ConsoleArt({ platform, className = "h-12 w-12" }: { platform: string | null; className?: string }) {
  const Drawing = (platform && DRAWINGS[platform]) || AllConsoles;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl p-0.5 shadow-sm ${className}`}
      style={{ background: "radial-gradient(circle at 50% 35%, #ffffff, #dfe5ee)" }}
    >
      <Drawing />
    </span>
  );
}
