import { describe, expect, it } from "vitest";
import { presenceRank, presenceText, toPresence } from "../src/lib/presence";

describe("status dos amigos", () => {
  it("lê online com o jogo aberto", () => {
    const p = toPresence({
      availability: "availableToPlay",
      primaryPlatformInfo: { onlineStatus: "online", platform: "PS5", lastOnlineDate: "2026-10-17T10:00:00Z" },
      gameTitleInfoList: [{ titleName: "Astro Bot", conceptIconUrl: "x.png" }],
    });
    expect(p).toMatchObject({ status: "online", platform: "PS5", game: { name: "Astro Bot", iconUrl: "x.png" } });
    expect(presenceText(p)).toBe("Online · jogando Astro Bot no PS5");
  });

  it("offline mostra há quanto tempo; sem dados é status oculto", () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    const off = toPresence({ primaryPlatformInfo: { onlineStatus: "offline", platform: "ps4", lastOnlineDate: "2026-10-17T09:00:00Z" } });
    expect(off.platform).toBe("PS4");
    expect(presenceText(off, now)).toBe("Offline · visto há 3 h");
    expect(presenceText(toPresence(null))).toBe("Status oculto");
    expect([presenceRank(toPresence({ onlineStatus: "online" })), presenceRank(off), presenceRank(undefined)]).toEqual([0, 1, 2]);
  });
});
