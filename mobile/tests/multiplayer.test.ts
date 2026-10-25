import { describe, expect, it } from "vitest";
import { hasMultiplayerTrophies, isMultiplayerTrophy } from "../src/lib/multiplayer";
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

describe("troféus do boost", () => {
  it("só os troféus que dependem do multiplayer entram no pedido", () => {
    const list = [
      row("Caçada em grupo", "Derrote um chefe em modo cooperativo com outro caçador"),
      row("Rei do multijogador", "Vença 10 partidas online"),
      row("Primeiros passos", "Conclua o prólogo"),
      { name: "Lobo solitário", detail: "Termine a campanha", originalName: "Lone Wolf" },
      { name: "Parceiro", detail: "Jogue junto", originalName: "Co-op Partner" },
    ];
    expect(list.filter(isMultiplayerTrophy).map((r) => r.name)).toEqual(["Caçada em grupo", "Rei do multijogador", "Parceiro"]);
  });
});

describe("tema automático", () => {
  it("segue o claro/escuro do sistema", () => {
    expect(resolveTheme("auto", true)).toBe("escuro");
    expect(resolveTheme("auto", false)).toBe("claro");
    expect(resolveTheme("horizon", true)).toBe("horizon");
  });
});

describe("lembrete do boost", async () => {
  const { boostReminderTime } = await import("../src/components/Boost");
  it("hoje à noite às 20h, amanhã às 20h, fim de semana no sábado às 15h", () => {
    const thu = new Date(2026, 9, 15, 10, 0); // quinta-feira
    expect(boostReminderTime("Hoje à noite", thu)?.getHours()).toBe(20);
    expect(boostReminderTime("Amanhã", thu)?.getDate()).toBe(16);
    const sat = boostReminderTime("Fim de semana", thu)!;
    expect([sat.getDay(), sat.getHours()]).toEqual([6, 15]);
    expect(boostReminderTime("Hoje à noite", new Date(2026, 9, 15, 22, 0))).toBeNull();
    expect(boostReminderTime("Agora", thu)).toBeNull();
  });
});
