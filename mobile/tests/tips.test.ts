import { describe, expect, it } from "vitest";
import { gameWrittenGuideUrl, trophyGuideUrl, trophyWrittenGuideUrl } from "../src/lib/tips";

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

describe("guia escrito (PlayStationTrophies.org)", () => {
  it("busca o troféu dentro do site, com o jogo entre aspas", () => {
    const url = new URL(trophyWrittenGuideUrl("God of War Ragnarök™", "Collector"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/search");
    expect(url.searchParams.get("q")).toBe('site:playstationtrophies.org "God of War Ragnarök" Collector trophy');
  });
  it("guia do jogo aponta para o roteiro do site", () => {
    const url = new URL(gameWrittenGuideUrl("Bloodborne"));
    expect(url.searchParams.get("q")).toBe('site:playstationtrophies.org "Bloodborne" trophy guide road map');
  });
});
