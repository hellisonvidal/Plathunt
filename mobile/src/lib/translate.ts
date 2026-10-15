import type { Settings } from "./settings";

/**
 * Tradução automática de textos da PSN (nomes e descrições de troféus) que a
 * Sony não traduziu para o idioma escolhido. Usa o tradutor público do Google
 * (o mesmo da extensão do navegador), sem chave e sem servidor próprio.
 */
const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

const TARGET: Record<Settings["language"], string> = {
  "pt-BR": "pt",
  "en-US": "en",
  "es-ES": "es",
};

/** Tamanho máximo do texto de cada pedido (o endereço tem limite de tamanho). */
const MAX_CHUNK = 1500;

class LineMismatch extends Error {}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Traduz um bloco de textos de uma vez, um por linha. */
async function translateChunk(texts: string[], target: string, fetcher: Fetch): Promise<string[]> {
  const q = encodeURIComponent(texts.join("\n"));
  const res = await fetcher(`${ENDPOINT}?client=gtx&sl=auto&tl=${target}&dt=t&q=${q}`);
  if (!res.ok) throw new Error(`Tradutor respondeu HTTP ${res.status}`);
  const data = (await res.json()) as [[string | null][] | null];
  const joined = (data?.[0] ?? []).map((segment) => segment?.[0] ?? "").join("");
  const lines = joined.split("\n").map((l) => l.trim());
  if (lines.length !== texts.length) throw new LineMismatch("Tradução veio com número de linhas diferente");
  return lines;
}

/**
 * Traduz vários textos para o idioma do app, mantendo a ordem. Textos vazios
 * ficam como estão. Se um bloco voltar com linhas trocadas, tenta os textos
 * um a um; outros erros (rede, limite de pedidos) são lançados, e quem chama
 * mostra o texto original.
 */
export async function translateTexts(
  texts: string[],
  language: Settings["language"],
  fetcher: Fetch = (url) => fetch(url),
): Promise<string[]> {
  const target = TARGET[language];
  const out = [...texts];
  // Cada texto vira uma linha: quebras internas viram espaço.
  const pending = texts
    .map((t, i) => ({ i, text: t.replace(/\s*\n\s*/g, " ").trim() }))
    .filter((p) => p.text.length > 0);

  const chunks: (typeof pending)[] = [];
  let current: typeof pending = [];
  let size = 0;
  for (const p of pending) {
    if (current.length && size + p.text.length > MAX_CHUNK) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(p);
    size += p.text.length + 1;
  }
  if (current.length) chunks.push(current);

  for (const chunk of chunks) {
    let translated: string[];
    try {
      translated = await translateChunk(
        chunk.map((p) => p.text),
        target,
        fetcher,
      );
    } catch (e) {
      // Erro de rede ou limite de pedidos: não adianta insistir texto a texto.
      if (!(e instanceof LineMismatch)) throw e;
      translated = [];
      for (const p of chunk) translated.push((await translateChunk([p.text], target, fetcher))[0]);
    }
    chunk.forEach((p, k) => (out[p.i] = translated[k] || texts[p.i]));
  }
  return out;
}
