import { describe, expect, it } from "vitest";
import { trophyGuideUrl } from "../src/lib/tips";

describe("trophyGuideUrl", () => {
  it("busca jogo + troféu no YouTube, no idioma escolhido", () => {
    const url = new URL(trophyGuideUrl("God of War Ragnarök™", "Rainha das Valquírias", "pt-BR"));
    expect(url.origin + url.pathname).toBe("https://www.youtube.com/results");
    expect(url.searchParams.get("search_query")).toBe("God of War Ragnarök Rainha das Valquírias troféu");
  });
  it("em inglês usa 'trophy guide'", () => {
    const url = new URL(trophyGuideUrl("Bloodborne", "Yharnam Sunrise", "en-US"));
    expect(url.searchParams.get("search_query")).toBe("Bloodborne Yharnam Sunrise trophy guide");
  });
});
