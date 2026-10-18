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

describe("guias escritos (PlayStationTrophies e PSNProfiles)", () => {
  const game = { name: "God of War Ragnarök™", platform: "PS5" };
  const q = (url: string) => new URL(url).searchParams.get("q");

  it("busca o troféu exato nas páginas de troféu de cada site", () => {
    const url = new URL(trophyWrittenGuideUrl("pst", game, "Collector"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/search");
    expect(url.searchParams.get("q")).toBe('site:playstationtrophies.org/game "God of War Ragnarök" "Collector" PS5');
    expect(q(trophyWrittenGuideUrl("psnp", game, "Collector"))).toBe(
      'site:psnprofiles.com/trophy "God of War Ragnarök" "Collector" PS5',
    );
  });

  it("guia completo do jogo em cada site, com a plataforma principal", () => {
    const old = { name: "Uncharted 2: Among Thieves™ Trophies", platform: "PS3" };
    expect(q(gameWrittenGuideUrl("psnp", old))).toBe('site:psnprofiles.com/guide "Uncharted 2: Among Thieves Trophy Guide" PS3');
    expect(q(gameWrittenGuideUrl("pst", { name: "Gravity Rush", platform: "PS4,PSVITA" }))).toBe(
      'site:playstationtrophies.org/game "Gravity Rush Trophy Guide" PS4',
    );
  });
});
