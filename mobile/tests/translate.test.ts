import { describe, expect, it } from "vitest";
import { translateTexts } from "../src/lib/translate";

/** Tradutor falso: devolve cada linha em maiúsculas, no formato do Google. */
function fakeFetch(calls: string[], opts: { breakBatches?: boolean } = {}) {
  return async (url: string) => {
    calls.push(url);
    const q = decodeURIComponent(new URL(url).searchParams.get("q")!);
    const lines = q.split("\n");
    if (opts.breakBatches && lines.length > 1) {
      return { ok: true, status: 200, json: async () => [[[lines.join(" ").toUpperCase(), q]]] };
    }
    const segments = lines.map((l, i) => [l.toUpperCase() + (i < lines.length - 1 ? "\n" : ""), l]);
    return { ok: true, status: 200, json: async () => [segments] };
  };
}

describe("translateTexts", () => {
  it("traduz tudo em um pedido e mantém a ordem e os vazios", async () => {
    const calls: string[] = [];
    const out = await translateTexts(["Platinum", "", "Beat\nthe game"], "pt-BR", fakeFetch(calls));
    expect(out).toEqual(["PLATINUM", "", "BEAT THE GAME"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("tl=pt");
    expect(calls[0]).toContain("sl=auto");
  });

  it("se o bloco voltar com linhas a menos, traduz um a um", async () => {
    const calls: string[] = [];
    const out = await translateTexts(["a", "b"], "es-ES", fakeFetch(calls, { breakBatches: true }));
    expect(out).toEqual(["A", "B"]);
    expect(calls).toHaveLength(3);
  });

  it("divide textos longos em vários pedidos", async () => {
    const calls: string[] = [];
    const texts = Array.from({ length: 40 }, (_, i) => `Trophy ${i} `.repeat(10));
    const out = await translateTexts(texts, "en-US", fakeFetch(calls));
    expect(out).toEqual(texts.map((t) => t.trim().toUpperCase()));
    expect(calls.length).toBeGreaterThan(1);
  });

  it("falha do tradutor vira erro (quem chama mostra o original)", async () => {
    const fail = async () => ({ ok: false, status: 429, json: async () => null });
    const calls: string[] = [];
    const counting = async (url: string) => (calls.push(url), fail());
    await expect(translateTexts(["x", "y"], "pt-BR", counting)).rejects.toThrow("429");
    expect(calls).toHaveLength(1);
  });
});
