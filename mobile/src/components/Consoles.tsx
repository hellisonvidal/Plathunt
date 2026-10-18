import { useId } from "react";

/**
 * Ilustrações 2D dos controles de cada console para o menu "Plataformas
 * jogadas", fiéis aos originais: DualSense (PS5), DualShock 4 (PS4),
 * DualShock 3 (PS3), o PS Vita (que é o próprio controle) e o controle do
 * PlayStation original para "Todas". As
 * cores são as dos controles; o quadradinho tem fundo claro neutro, para
 * ficarem bonitos em qualquer tema.
 */

/** Prefixo único por desenho: os gradientes de vários desenhos não se misturam. */
const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, "");

/** Direcional com as quatro setas separadas, como nos controles da Sony. */
function DPad({ x, y, fill, stroke }: { x: number; y: number; fill: string; stroke: string }) {
  const arrow = "M0 0 h3.4 v3.6 l-1.7 2 l-1.7 -2 Z";
  return (
    <g fill={fill} stroke={stroke} strokeWidth="0.6" strokeLinejoin="round">
      {[0, 90, 180, 270].map((r) => (
        <path key={r} d={arrow} transform={`translate(${x} ${y}) rotate(${r}) translate(-1.7 -7.4)`} />
      ))}
    </g>
  );
}

/** Botões △ ○ ✕ □: cor do botão e cores dos símbolos (null = cinza do DualSense). */
function FaceButtons({
  x,
  y,
  button,
  ring,
  symbols,
}: {
  x: number;
  y: number;
  button: string;
  ring: string;
  symbols: [string, string, string, string];
}) {
  const [tri, circ, cross, sq] = symbols;
  const d = 5.8;
  return (
    <g>
      {[
        [0, -d],
        [d, 0],
        [0, d],
        [-d, 0],
      ].map(([dx, dy]) => (
        <circle key={`${dx},${dy}`} cx={x + dx} cy={y + dy} r="2.8" fill={button} stroke={ring} strokeWidth="0.6" />
      ))}
      <g fill="none" strokeWidth="1.1" strokeLinejoin="round">
        <path d={`M${x} ${y - d - 1.7} l1.8 3 h-3.6 Z`} stroke={tri} />
        <circle cx={x + d} cy={y} r="1.6" stroke={circ} />
        <path d={`M${x - 1.3} ${y + d - 1.3} l2.6 2.6 m0 -2.6 l-2.6 2.6`} stroke={cross} />
        <rect x={x - d - 1.35} y={y - 1.35} width="2.7" height="2.7" stroke={sq} />
      </g>
    </g>
  );
}

/** Analógico com a borda e o topo côncavo. */
function Stick({ x, y, top, rim }: { x: number; y: number; top: string; rim: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="5.6" fill={rim} />
      <circle cx={x} cy={y} r="4.2" fill={top} />
      <circle cx={x} cy={y} r="2.6" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="0.6" />
    </g>
  );
}

const Shadow = ({ id }: { id: string }) => (
  <>
    <defs>
      <radialGradient id={id} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#000" stopOpacity="0.3" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="48" cy="83" rx="38" ry="3.5" fill={`url(#${id})`} />
  </>
);

/**
 * DualSense (PS5): branco com o miolo preto, touchpad grande no topo com a
 * barra de luz azul nas laterais, punhos longos e abertos e símbolos cinza.
 */
function Ps5() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#d5dbe4"/></linearGradient>
        <linearGradient id={`${u}k`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a2f3a"/><stop offset="1" stopColor="#0b0d12"/></linearGradient>
      </defs>
      <Shadow id={`${u}sh`} />
      <path d="M12 38 C14 29, 22 26, 31 27 L65 27 C74 26, 82 29, 84 38 L91 68 C93 77, 86 83, 79 79 C74 76, 70 68, 66 62 L30 62 C26 68, 22 76, 17 79 C10 83, 3 77, 5 68 Z" fill={`url(#${u}w)`} stroke="#aab3c2" strokeWidth="0.8"/>
      <path d="M29 43 L67 43 C67 53, 65 59, 63 62 L33 62 C31 59, 29 53, 29 43 Z" fill={`url(#${u}k)`}/>
      <rect x="33" y="27.5" width="30" height="15" rx="2.5" fill="#f4f6f9" stroke="#c4ccd8" strokeWidth="0.8"/>
      <path d="M33.8 30 v10 M62.2 30 v10" stroke="#3d8bff" strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="27.5" y="29" width="2.4" height="4" rx="1.2" fill="#9aa3b2"/>
      <rect x="66.1" y="29" width="2.4" height="4" rx="1.2" fill="#9aa3b2"/>
      <DPad x={22} y={40} fill="#e6eaf0" stroke="#9aa3b2"/>
      <FaceButtons x={74} y={40} button="#eef1f5" ring="#aab3c2" symbols={["#8a93a3", "#8a93a3", "#8a93a3", "#8a93a3"]}/>
      <Stick x={38} y={53} top="#22262e" rim="#0b0d12"/>
      <Stick x={58} y={53} top="#22262e" rim="#0b0d12"/>
      <path d="M45.2 58.6 h5.6" stroke="#4a505c" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

/**
 * DualShock 4 (PS4): todo preto e mais compacto, touchpad escuro, barra de
 * luz no topo, botões Share e Options e símbolos coloridos em tons pastel.
 */
function Ps4() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a404c"/><stop offset="0.45" stopColor="#1a1d24"/><stop offset="1" stopColor="#0a0b0e"/></linearGradient>
        <filter id={`${u}glow`} x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="1.3"/></filter>
      </defs>
      <Shadow id={`${u}sh`} />
      <path d="M36 29.5 h24" stroke="#3d8bff" strokeWidth="4" filter={`url(#${u}glow)`}/>
      <path d="M17 36 C19 30, 25 29, 31 29 L65 29 C71 29, 77 30, 79 36 L86 60 C88 69, 82 74, 76 71 C72 69, 69 65, 66 62 L30 62 C27 65, 24 69, 20 71 C14 74, 8 69, 10 60 Z" fill={`url(#${u}b)`} stroke="#4a5160" strokeWidth="0.8"/>
      <path d="M36 29.4 h24" stroke="#b5d6ff" strokeWidth="1.2" strokeLinecap="round"/>
      <rect x="35" y="30.5" width="26" height="13" rx="2" fill="#20242c" stroke="#3f4552" strokeWidth="0.8"/>
      <rect x="30" y="31.5" width="2.2" height="4" rx="1.1" fill="#6b7384"/>
      <rect x="63.8" y="31.5" width="2.2" height="4" rx="1.1" fill="#6b7384"/>
      <DPad x={23} y={42} fill="#2c313b" stroke="#5b6270"/>
      <FaceButtons x={73} y={42} button="#15181e" ring="#3f4552" symbols={["#3fd39a", "#ff6b63", "#7aa8ff", "#ee8de2"]}/>
      <Stick x={38} y={53} top="#2c313b" rim="#4a5160"/>
      <Stick x={58} y={53} top="#2c313b" rim="#4a5160"/>
      <circle cx="48" cy="55" r="2" fill="#20242c" stroke="#5b6270" strokeWidth="0.6"/>
      <g fill="#4a5160">{[44, 46, 48, 50, 52].map((x) => <circle key={x} cx={x} cy="48" r="0.45"/>)}</g>
    </svg>
  );
}

/**
 * DualShock 3 (PS3): preto brilhante no formato clássico, sem touchpad, com
 * SELECT, START, o botão PS redondo prateado e as luzes 1–4 no topo.
 */
function Ps3() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a505c"/><stop offset="0.35" stopColor="#1c1f26"/><stop offset="1" stopColor="#08090c"/></linearGradient>
        <radialGradient id={`${u}ps`} cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#8d94a0"/></radialGradient>
      </defs>
      <Shadow id={`${u}sh`} />
      <path d="M19 35 C21 30, 27 29, 33 30 C40 32, 56 32, 63 30 C69 29, 75 30, 77 35 L88 66 C90 75, 84 81, 78 78 C73 76, 70 68, 66 62 L30 62 C26 68, 23 76, 18 78 C12 81, 6 75, 8 66 Z" fill={`url(#${u}b)`} stroke="#5a6170" strokeWidth="0.8"/>
      <path d="M21 36 C31 33, 65 33, 75 36" fill="none" stroke="#ffffff" strokeWidth="1.3" opacity="0.35" strokeLinecap="round"/>
      <g>{[42, 46, 50, 54].map((x, i) => <rect key={x} x={x - 1.2} y="32.6" width="2.4" height="1.1" rx="0.5" fill={i === 0 ? "#ff3b30" : "#3a2020"}/>)}</g>
      <rect x="38" y="40" width="6" height="2.2" rx="1.1" fill="#5b6270"/>
      <path d="M52 39.3 l5 1.8 l-5 1.8 Z" fill="#5b6270"/>
      <circle cx="48" cy="47" r="3.2" fill={`url(#${u}ps)`} stroke="#2a2f3a" strokeWidth="0.5"/>
      <DPad x={24} y={44} fill="#1b1e24" stroke="#5b6270"/>
      <FaceButtons x={72} y={44} button="#111317" ring="#4a5160" symbols={["#22d38a", "#ff4b40", "#5b8cff", "#ff6fd8"]}/>
      <Stick x={37} y={55} top="#1b1e24" rim="#3a404c"/>
      <Stick x={59} y={55} top="#1b1e24" rim="#3a404c"/>
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

/** Controle do PlayStation original (todas as plataformas): cinza, sem analógicos, com o logo colorido. */
function AllConsoles() {
  const u = useUid();
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e6e8ec"/><stop offset="1" stopColor="#b6bbc3"/></linearGradient>
      </defs>
      <Shadow id={`${u}sh`} />
      <path d="M19 37 C21 32, 27 31, 33 32 C40 34, 56 34, 63 32 C69 31, 75 32, 77 37 L87 66 C89 74, 84 79, 78 76 C74 74, 71 67, 67 61 L29 61 C25 67, 22 74, 18 76 C12 79, 7 74, 9 66 Z" fill={`url(#${u}b)`} stroke="#8a919c" strokeWidth="0.8"/>
      <path d="M21 38 C31 35, 65 35, 75 38" fill="none" stroke="#ffffff" strokeWidth="1.3" opacity="0.8" strokeLinecap="round"/>
      <rect x="39" y="47" width="6" height="2" rx="1" fill="#7d838d"/>
      <rect x="51" y="47" width="6" height="2" rx="1" fill="#7d838d"/>
      <g transform="translate(48 40.5)">
        <path d="M-1.6 -4 v8 l-2 -0.8 v-6.4 Z" fill="#e0433b"/>
        <path d="M-1.6 -4 c3.5 0 4 3.4 0 3.6" fill="none" stroke="#f2b632" strokeWidth="1.3"/>
        <path d="M-4.2 2.4 l3 1.2" stroke="#2ea36b" strokeWidth="1.3"/>
        <path d="M0.2 3 c2.5 -1 4.2 -0.6 3.6 0.4" fill="none" stroke="#3a6fd8" strokeWidth="1.3"/>
      </g>
      <DPad x={24} y={46} fill="#a7adb7" stroke="#6b727e"/>
      <FaceButtons x={72} y={46} button="#9aa1ab" ring="#6b727e" symbols={["#1f9e6e", "#e0433b", "#3a6fd8", "#c561b8"]}/>
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
