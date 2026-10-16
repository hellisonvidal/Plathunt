import { useId } from "react";

/**
 * Ilustrações 2D dos consoles para o menu "Plataformas jogadas": PS5 com o
 * suporte e a luz azul, PS4 com a faixa de luz, PS3, PS Vita com a tela e um
 * DualSense para "Todas". As cores são as dos aparelhos; o quadradinho tem
 * fundo claro neutro, para ficarem bonitas em qualquer tema.
 */

/** Prefixo único por desenho: os gradientes de vários desenhos não se misturam. */
const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, "");

function Ps5() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}p5w`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff"/><stop offset="0.6" stopColor="#eef1f6"/><stop offset="1" stopColor="#c9d0db"/></linearGradient>
        <linearGradient id={`${u}p5wr`} x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#ffffff"/><stop offset="0.6" stopColor="#eef1f6"/><stop offset="1" stopColor="#c9d0db"/></linearGradient>
        <linearGradient id={`${u}p5c`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0b0d12"/><stop offset="0.5" stopColor="#2a2f3a"/><stop offset="1" stopColor="#0b0d12"/></linearGradient>
        <linearGradient id={`${u}p5l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fb4ff" stopOpacity="0"/><stop offset="0.5" stopColor="#4d9bff"/><stop offset="1" stopColor="#7fb4ff" stopOpacity="0"/></linearGradient>
        <radialGradient id={`${u}p5s`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" stopOpacity="0.35"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="48" cy="88" rx="26" ry="4" fill={`url(#${u}p5s)`}/>
      <rect x="38" y="80" width="20" height="6" rx="3" fill="#1b1f27"/>
      <rect x="40.5" y="10" width="15" height="72" rx="3" fill={`url(#${u}p5c)`}/>
      <rect x="46.8" y="16" width="2.4" height="60" rx="1.2" fill={`url(#${u}p5l)`}/>
      <path d="M41 6 C 22 12, 14 30, 15 52 C 16 70, 24 80, 41 84 Z" fill={`url(#${u}p5w)`} stroke="#aab3c2" strokeWidth="0.8"/>
      <path d="M55 6 C 74 12, 82 30, 81 52 C 80 70, 72 80, 55 84 Z" fill={`url(#${u}p5wr)`} stroke="#aab3c2" strokeWidth="0.8"/>
      <path d="M36 12 C 25 20, 20 34, 21 50" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
      <rect x="44" y="70" width="8" height="1.6" rx="0.8" fill="#4a5262"/>
    </svg>
  );
}

function Ps4() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}p4t`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a404c"/><stop offset="1" stopColor="#14171d"/></linearGradient>
        <linearGradient id={`${u}p4b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b3039"/><stop offset="1" stopColor="#0d0f13"/></linearGradient>
        <linearGradient id={`${u}p4g`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" stopOpacity="0"/><stop offset="0.45" stopColor="#ffffff" stopOpacity="0.25"/><stop offset="0.55" stopColor="#ffffff" stopOpacity="0"/></linearGradient>
        <filter id={`${u}p4glow`} x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="1.6"/></filter>
        <radialGradient id={`${u}p4s`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" stopOpacity="0.35"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="50" cy="70" rx="40" ry="5" fill={`url(#${u}p4s)`}/>
      <path d="M12 34 L 74 34 L 84 50 L 22 50 Z" fill={`url(#${u}p4t)`} stroke="#4a5160" strokeWidth="0.8" strokeLinejoin="round"/>
      <path d="M12 34 L 74 34 L 84 50 L 22 50 Z" fill={`url(#${u}p4g)`}/>
      <path d="M50 34 L 60 50" stroke="#0b0d12" strokeWidth="1.2"/>
      <path d="M22 51.5 L 84 51.5" stroke="#4d9bff" strokeWidth="4.5" filter={`url(#${u}p4glow)`}/>
      <path d="M22 51.5 L 84 51.5" stroke="#b5d6ff" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M19 53 L 81 53 L 86 64 L 24 64 Z" fill={`url(#${u}p4b)`} stroke="#3a404c" strokeWidth="0.8" strokeLinejoin="round"/>
      <path d="M58 53 L 64 64" stroke="#0b0d12" strokeWidth="1.2"/>
      <path d="M14 35 L 72 35" stroke="#6a7384" strokeWidth="0.8" opacity="0.8"/>
    </svg>
  );
}

function Ps3() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}p3b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a505c"/><stop offset="0.35" stopColor="#1c1f26"/><stop offset="1" stopColor="#08090c"/></linearGradient>
        <linearGradient id={`${u}p3s`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9aa3b2"/><stop offset="0.5" stopColor="#e6eaf0"/><stop offset="1" stopColor="#9aa3b2"/></linearGradient>
        <radialGradient id={`${u}p3sh`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" stopOpacity="0.35"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="48" cy="70" rx="40" ry="5" fill={`url(#${u}p3sh)`}/>
      <path d="M10 64 L 10 44 C 10 34, 22 28, 48 28 C 74 28, 86 34, 86 44 L 86 64 Z" fill={`url(#${u}p3b)`} stroke="#5a6170" strokeWidth="0.8"/>
      <path d="M16 38 C 24 32, 72 32, 80 38" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.35" strokeLinecap="round"/>
      <rect x="10" y="50" width="76" height="3" fill={`url(#${u}p3s)`}/>
      <rect x="22" y="57" width="34" height="2" rx="1" fill="#3a404c"/>
      <circle cx="74" cy="58" r="1.6" fill="#ff4b4b"/>
      <circle cx="74" cy="58" r="3" fill="#ff4b4b" opacity="0.25"/>
      <text x="48" y="44" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="7" fontWeight="700" fill="#c9ced8" letterSpacing="1.5">PS3</text>
    </svg>
  );
}

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

function AllConsoles() {
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

const DRAWINGS: Record<string, () => React.ReactElement> = {
  PS5: Ps5,
  PS4: Ps4,
  PS3: Ps3,
  "PS Vita": Vita,
};

/** Imagem 2D do console da plataforma (null = todas). */
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
