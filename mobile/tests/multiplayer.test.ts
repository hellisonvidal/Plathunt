import { describe, expect, it } from "vitest";
import { hasMultiplayerTrophies } from "../src/lib/multiplayer";
import { resolveTheme } from "../src/lib/theme";

const row = (name: string, detail = "") => ({ name, detail });

describe("jogos com multiplayer", () => {
  it("reconhece troféus online e cooperativos em vários idiomas", () => {
    expect(hasMultiplayerTrophies([row("Rei do multijogador", "Vença 10 partidas online")])).toBe(true);
    expect(hasMultiplayerTrophies([row("Team Player", "Finish a co-op mission")])).toBe(true);
    expect(hasMultiplayerTrophies([row("Champion", "Gagnez un match en ligne")])).toBe(true);
    expect(hasMultiplayerTrophies([row("仲間", "オンラインで10勝する")])).toBe(true);
    expect(hasMultiplayerTrophies([row("Ratchet & Clank", "Conclua o prólogo"), row("Ferreiro", "Melhore uma arma")])).toBe(false);
  });
});

describe("tema automático", () => {
  it("segue o claro/escuro do sistema", () => {
    expect(resolveTheme("auto", true)).toBe("escuro");
    expect(resolveTheme("auto", false)).toBe("claro");
    expect(resolveTheme("horizon", true)).toBe("horizon");
  });
});
