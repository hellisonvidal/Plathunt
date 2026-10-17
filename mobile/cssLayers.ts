/**
 * Desfaz as camadas de CSS (@layer): remove as declarações "@layer a, b;" e
 * tira o conteúdo de cada "@layer nome { … }" para fora, na mesma posição.
 * As camadas do Tailwind já vêm na ordem de prioridade (theme, base,
 * utilities) e as regras do app vêm depois, então a cascata fica igual.
 */
export function flattenCascadeLayers(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@layer", i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    // Fim do prelúdio: ";" (só declara a ordem) ou "{" (bloco da camada).
    let j = at + 6;
    while (j < css.length && css[j] !== ";" && css[j] !== "{") j++;
    if (css[j] === ";") {
      i = j + 1;
      continue;
    }
    // Acha a chave que fecha o bloco, ignorando chaves dentro de strings.
    let depth = 1;
    let k = j + 1;
    let quote: string | null = null;
    for (; k < css.length && depth > 0; k++) {
      const ch = css[k];
      if (quote) {
        if (ch === "\\") k++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    // O conteúdo pode ter outras camadas dentro: desfaz também.
    out += flattenCascadeLayers(css.slice(j + 1, k - 1));
    i = k;
  }
  return out;
}
