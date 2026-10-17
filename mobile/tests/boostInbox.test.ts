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

const { boostLink, getInbox, importBoost, parseBoostText, setInboxStatus } = await import("../src/lib/boostInbox");
const { notificationsEnabled } = await import("../src/lib/notify");
const { DEFAULT_SETTINGS } = await import("../src/lib/settings");

const boost = {
  game: { id: "NPWR1", name: "Helldivers 2 ™ — Edição", platform: "PS5", iconUrl: "x.png" },
  trophies: ["Democracia", "Ação conjunta"],
  players: 3,
  when: "Hoje à noite",
  note: "tenho mic 🎤",
  createdAt: "2026-10-17T12:00:00.000Z",
};

describe("pedidos de boost recebidos", () => {
  beforeEach(() => mem.clear());

  it("o pedido viaja no link da mensagem, com acentos e emojis", () => {
    const text = `📣 BOOST…\n🔗 Abrir no Trophy Mania: ${boostLink(boost, "Aloy_Hunter")}`;
    const parsed = parseBoostText(text)!;
    expect(parsed).toMatchObject({ from: "Aloy_Hunter", trophies: boost.trophies, players: 3, note: "tenho mic 🎤" });
    expect(parsed.game.name).toBe(boost.game.name);
    expect(parseBoostText("mensagem qualquer")).toBeNull();
  });

  it("guarda só pedidos de outros jogadores, sem repetir", () => {
    const link = boostLink(boost, "Aloy_Hunter");
    expect(importBoost(link, "aloy_hunter")).toEqual({ ok: false, reason: "meu" });
    const first = importBoost(link, "Kratos_BR");
    expect(first.ok && !first.duplicate).toBe(true);
    const again = importBoost(link, "Kratos_BR");
    expect(again.ok && again.duplicate).toBe(true);
    expect(getInbox()).toHaveLength(1);
    setInboxStatus(getInbox()[0].id, "aceito");
    expect(getInbox()[0].status).toBe("aceito");
  });

  it("respeita a chave geral e cada tipo de notificação", () => {
    expect(notificationsEnabled("merits", { ...DEFAULT_SETTINGS })).toBe(true);
    expect(notificationsEnabled("merits", { ...DEFAULT_SETTINGS, notifications: false })).toBe(false);
    expect(notificationsEnabled("friends", { ...DEFAULT_SETTINGS, notifyFriends: false })).toBe(false);
  });
});
