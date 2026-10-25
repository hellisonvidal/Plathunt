import { describe, expect, it } from "vitest";
import { findTrophyLink, guideKey, pageLinks, pstSlugs } from "../src/lib/guideLinks";

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
