import { beforeEach, describe, expect, it } from "vitest";

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const lib = await import("../src/lib/challenges");
const { evaluateMerits } = await import("../src/lib/merits");

const start = new Date("2026-10-01T00:00:00Z");
const base = {
  game: { name: "Astro Bot", iconUrl: null, titleId: "NPWR1", service: "trophy2" as const, platform: "PS5" },
  trophy: { id: 3, name: "Rápido", detail: null, type: "platinum" as const, iconUrl: null, rate: 2 },
  players: [
    { accountId: "me", onlineId: "Eu", avatarUrl: null },
    { accountId: "a", onlineId: "Aloy", avatarUrl: null },
    { accountId: "b", onlineId: "Ellie", avatarUrl: null },
  ],
};

describe("desafios", () => {
  beforeEach(() => mem.clear());

  it("vence quem conquista primeiro depois do início e dentro do prazo", () => {
    const c = lib.addChallenge(base, 7, start);
    const r = lib.rankChallenge(c, {
      me: { earnedAt: "2026-10-01T10:00:00Z" },
      a: { earnedAt: "2026-09-20T00:00:00Z" },
      b: { earnedAt: "2026-10-02T00:00:00Z" },
    });
    expect(r.me).toMatchObject({ status: "venceu", position: 1 });
    expect(r.a.status).toBe("ja-tinha");
    expect(r.b).toMatchObject({ status: "conquistou", position: 2 });
    const late = lib.rankChallenge(c, { me: { earnedAt: "2026-10-20T00:00:00Z" }, a: "sem-jogo", b: { earnedAt: null } });
    expect([late.me.status, late.a.status, late.b.status]).toEqual(["fora-do-prazo", "sem-jogo", "pendente"]);
  });

  it("acha o troféu pelo id na mesma versão e pelo nome em outra", () => {
    const row = (id: number, name: string) => ({ id, type: "gold" as const, name, detail: null, iconUrl: null, hidden: false, groupId: "default", earned: true, earnedAt: "x", rate: null });
    expect(lib.findTrophy([row(3, "Outro"), row(5, "Rápido")], base.trophy, true)?.id).toBe(3);
    expect(lib.findTrophy([row(3, "Outro"), row(5, "Rápido")], base.trophy, false)?.id).toBe(5);
  });

  it("salva, apura e alimenta os méritos de desafio", () => {
    const c = lib.addChallenge(base, null, start);
    lib.saveResults(c.id, lib.rankChallenge(c, { me: { earnedAt: "2026-10-01T05:00:00Z" }, a: { earnedAt: null }, b: { earnedAt: null } }));
    const stats = lib.challengeStats(lib.getChallenges());
    expect(stats).toMatchObject({ created: 1, wins: 1, podiums: 1, completed: 1, rivals: 2, defeated: 2, platinumWins: 1, rareWins: 1, gamesWon: 1 });
    expect(stats.fastestWinHours).toBe(5);
    const results = evaluateMerits({
      profile: { accountId: "me", onlineId: "Eu", avatarUrl: null, aboutMe: null, isPlus: false, level: 1, levelProgress: 0, earned: null },
      titles: [], playtime: new Map(), playedOn: new Map(), friends: 2, reactions: 0, challenges: stats, now: Date.now(),
    });
    const done = (id: string) => results.find((r) => r.merit.id === id)?.done;
    expect(done("desafio-vitorias-1")).toBe(true);
    expect(done("desafio-relampago")).toBe(true);
    expect(done("desafio-raridade")).toBe(true);
    expect(done("desafio-vitorias-3")).toBe(false);
    lib.removeChallenge(c.id);
    expect(lib.getChallenges()).toEqual([]);
  });
});
