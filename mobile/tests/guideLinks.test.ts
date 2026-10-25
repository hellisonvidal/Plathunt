import { afterEach, describe, expect, it, vi } from "vitest";
import { findTrophyLink, guideKey, pageLinks, pstSlugs, resolveGameGuide, resolveTrophyGuide } from "../src/lib/guideLinks";

describe("links diretos dos guias", () => {
  it("monta o endereço do PlayStationTrophies pelo nome do jogo", () => {
    expect(pstSlugs("Marvel's Spider-Man 2")).toEqual(["marvels-spider-man-2"]);
    expect(pstSlugs("God of War Ragnarök")).toEqual(["god-of-war-ragnarok"]);
    expect(pstSlugs("God of War: Ragnarok™ Trophies")).toEqual(["god-of-war-ragnarok"]);
    expect(pstSlugs("Ratchet & Clank: Rift Apart")).toEqual(["ratchet-clank-rift-apart", "ratchet-and-clank-rift-apart"]);
  });

  it("acha o link do troféu na página, com ou sem id e com apóstrofo", () => {
    const html = `
      <a href="/game/god-of-war-ragnarok/trophy/519018-how-it-039s-going.html">How it's Going</a>
      <a href="https://www.playstationtrophies.org/game/god-of-war-ragnarok/trophy/wayfarer.html">Wayfarer</a>
      <a href="/game/god-of-war-ragnarok/guide/">Guia</a>`;
    const links = pageLinks(html, /^\/game\/god-of-war-ragnarok\/trophy\/[^/]+\.html$/);
    expect(links).toHaveLength(2);
    expect(findTrophyLink(links, "How it’s Going")).toBe("/game/god-of-war-ragnarok/trophy/519018-how-it-039s-going.html");
    expect(findTrophyLink(links, "Wayfarer")).toBe("/game/god-of-war-ragnarok/trophy/wayfarer.html");
    expect(findTrophyLink(links, "Phalanx")).toBeNull();
  });

  it("compara nomes do PSNProfiles sem acento e com o endereço codificado", () => {
    expect(guideKey("god-of-war-ragnar%C3%B6k")).toBe(guideKey("God of War Ragnarök"));
    const html = `<a href="/trophies/19260-god-of-war-ragnar%C3%B6k">x</a><a href="/trophy/19260-god-of-war-ragnar%C3%B6k/1-the-bear-and-the-wolf">y</a>`;
    expect(pageLinks(html, /^\/trophies\/\d+-[^/]+$/)).toEqual(["/trophies/19260-god-of-war-ragnar%C3%B6k"]);
    expect(findTrophyLink(pageLinks(html, /^\/trophy\//), "The Bear and the Wolf")).toBe(
      "/trophy/19260-god-of-war-ragnar%C3%B6k/1-the-bear-and-the-wolf",
    );
  });
});

describe("abrir o guia certo", () => {
  const game = (name: string) => ({ name, platform: "PS5" });
  /** Simula os sites: cada endereço responde com HTML, um status de erro ou falha de rede. */
  function sites(pages: Record<string, string | number>) {
    vi.stubGlobal("fetch", async (url: string) => {
      const page = pages[url];
      if (page === undefined) return new Response("", { status: 404 });
      if (page === 0) throw new Error("rede");
      return typeof page === "number" ? new Response("", { status: page }) : new Response(page, { status: 200 });
    });
  }
  afterEach(() => vi.unstubAllGlobals());

  it("PlayStationTrophies: abre o guia do jogo e a página do troféu", async () => {
    const list = `<a href="/game/alpha-quest/guide/">Guide</a><a href="/game/alpha-quest/trophy/123-first-steps.html">x</a>`;
    sites({ "https://www.playstationtrophies.org/game/alpha-quest/trophies/": list });
    expect(await resolveGameGuide("pst", game("Alpha Quest™"))).toBe("https://www.playstationtrophies.org/game/alpha-quest/guide/");
    expect(await resolveTrophyGuide("pst", game("Alpha Quest™"), "First Steps")).toBe(
      "https://www.playstationtrophies.org/game/alpha-quest/trophy/123-first-steps.html",
    );
  });

  it("PlayStationTrophies bloqueado: abre o guia pelo endereço montado, não o Google", async () => {
    sites({ "https://www.playstationtrophies.org/game/beta-run/trophies/": 403 });
    expect(await resolveGameGuide("pst", game("Beta Run"))).toBe("https://www.playstationtrophies.org/game/beta-run/guide/");
    sites({ "https://www.playstationtrophies.org/game/beta-run-2/trophies/": 0 });
    expect(await resolveTrophyGuide("pst", game("Beta Run 2"), "Win")).toBe(
      "https://www.playstationtrophies.org/game/beta-run-2/trophies/",
    );
  });

  it("jogo que o site não tem: busca no Google", async () => {
    sites({});
    expect(await resolveGameGuide("pst", game("Gamma Zero"))).toMatch(/^https:\/\/www\.google\.com\/search/);
  });

  it("PSNProfiles: acha o jogo pela busca do site e abre o guia e o troféu", async () => {
    sites({
      "https://psnprofiles.com/search/games?q=Delta%20Force%20X": `<a href="/trophies/555-delta-force-x">Delta</a>`,
      "https://psnprofiles.com/trophies/555-delta-force-x": `<a href="/guide/77-delta-force-x-trophy-guide">Guide</a><a href="/trophy/555-delta-force-x/3-hard-one">t</a>`,
    });
    expect(await resolveGameGuide("psnp", game("Delta Force X"))).toBe("https://psnprofiles.com/guide/77-delta-force-x-trophy-guide");
    expect(await resolveTrophyGuide("psnp", game("Delta Force X"), "Hard One")).toBe(
      "https://psnprofiles.com/trophy/555-delta-force-x/3-hard-one",
    );
  });

  it("PSNProfiles bloqueado: abre a busca do próprio site", async () => {
    sites({ "https://psnprofiles.com/search/games?q=Echo%20Night": "<title>Just a moment...</title>" });
    expect(await resolveGameGuide("psnp", game("Echo Night"))).toBe("https://psnprofiles.com/search/games?q=Echo%20Night");
  });
});
