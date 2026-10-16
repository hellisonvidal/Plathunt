/**
 * Desenhos 2D (vetor plano) dos consoles, para o menu "Plataformas jogadas".
 * As cores são fixas (o branco do PS5, o preto do PS4...) e o fundo do
 * quadradinho é neutro, para ficar legível em qualquer tema.
 */
const EDGE = "#3a4150";

function Ps5() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* Miolo preto entre as duas placas brancas */}
      <rect x="26" y="8" width="12" height="48" rx="3" fill="#15181e" />
      <rect x="30" y="12" width="4" height="40" rx="2" fill="#2f6fe8" opacity="0.85" />
      {/* Placas brancas curvas, mais largas embaixo como no console */}
      <path d="M27 5 C 14 10, 7 26, 8 42 C 9 52, 15 58, 27 59 Z" fill="#f4f6f9" stroke={EDGE} strokeWidth="1.5" />
      <path d="M37 5 C 50 10, 57 26, 56 42 C 55 52, 49 58, 37 59 Z" fill="#f4f6f9" stroke={EDGE} strokeWidth="1.5" />
    </svg>
  );
}

function Ps4() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* Duas lâminas pretas inclinadas com a faixa de luz azul */}
      <path d="M10 24 L 50 24 L 56 34 L 16 34 Z" fill="#1b1e24" stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 35 L 54 35 L 58 42 L 18 42 Z" fill="#23272e" stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 34.5 L 55 34.5" stroke="#3d8bff" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M35 24 L 41 34" stroke="#3a3f48" strokeWidth="1" />
    </svg>
  );
}

function Ps3() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* PS3 slim: caixa preta arredondada com a entrada do disco */}
      <rect x="8" y="22" width="48" height="22" rx="6" fill="#1b1e24" stroke={EDGE} strokeWidth="1.5" />
      <path d="M8 34 H 56" stroke="#2c3038" strokeWidth="1.2" />
      <rect x="16" y="27" width="22" height="2" rx="1" fill="#5b6270" />
      <circle cx="49" cy="28" r="1.6" fill="#d23b3b" />
      <rect x="44" y="38" width="7" height="2" rx="1" fill="#5b6270" />
    </svg>
  );
}

function Vita() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* Portátil: tela no centro, analógicos, direcional e os 4 botões */}
      <rect x="4" y="20" width="56" height="26" rx="13" fill="#1b1e24" stroke={EDGE} strokeWidth="1.5" />
      <rect x="20" y="24" width="24" height="18" rx="2" fill="#2f6fe8" />
      <rect x="22" y="26" width="20" height="14" rx="1.5" fill="#5a9bff" opacity="0.5" />
      <path d="M11 29 h4 M13 27 v4" stroke="#c9ced8" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="13" cy="38" r="2.4" fill="#4a505c" />
      <circle cx="51" cy="38" r="2.4" fill="#4a505c" />
      <circle cx="51" cy="26" r="1.1" fill="#3fbf8f" />
      <circle cx="54" cy="29" r="1.1" fill="#e2564f" />
      <circle cx="51" cy="32" r="1.1" fill="#6b9cf0" />
      <circle cx="48" cy="29" r="1.1" fill="#d97ad0" />
    </svg>
  );
}

function AllConsoles() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* Controle: "todas as plataformas" */}
      <path
        d="M18 20 h28 c6 0 10 4 11.5 10.5 l3 13 c1 4.5 -2.5 8 -6.5 6.5 -3 -1.2 -5 -4.5 -7 -7.5 H 17 c-2 3 -4 6.3 -7 7.5 -4 1.5 -7.5 -2 -6.5 -6.5 l3 -13 C 8 24 12 20 18 20 Z"
        fill="#1b1e24"
        stroke={EDGE}
        strokeWidth="1.5"
      />
      <path d="M17 29 v8 M13 33 h8" stroke="#c9ced8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="46" cy="28.5" r="1.8" fill="#3fbf8f" />
      <circle cx="50.5" cy="33" r="1.8" fill="#e2564f" />
      <circle cx="46" cy="37.5" r="1.8" fill="#6b9cf0" />
      <circle cx="41.5" cy="33" r="1.8" fill="#d97ad0" />
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
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-[#e9edf3] p-1 ${className}`}>
      <Drawing />
    </span>
  );
}
