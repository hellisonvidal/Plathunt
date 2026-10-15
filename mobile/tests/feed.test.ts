import { describe, expect, it } from "vitest";
import { feedItemsFromTrophies, mergeTrophies, pickFeedSources, sortFeed, type FeedSource } from "../src/lib/feed";
import type { Title } from "../src/psn/types";

const NOW = new Date("2026-10-15T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const zero = { bronze: 0, silver: 0, gold: 0, platinum: 0 };

function title(id: string, lastUpdated: string): Title {
  return { id, service: "trophy2", name: id, iconUrl: null, platform: "PS5", progress: 0, earned: zero, defined: zero, lastUpdated };
}
const owner = (id: string) => ({ accountId: id, onlineId: id, avatarUrl: null, isMe: id === "me" });

describe("pickFeedSources", () => {
  it("mantém só jogos com troféus na janela, mais recentes primeiro, até o limite", () => {
    const sources: FeedSource[] = [
      { owner: owner("me"), title: title("A", daysAgo(2)) },
      { owner: owner("f1"), title: title("B", daysAgo(40)) },
      { owner: owner("f2"), title: title("C", daysAgo(1)) },
      { owner: owner("f3"), title: title("D", daysAgo(10)) },
    ];
    expect(pickFeedSources(sources, NOW, 2).map((s) => s.title.id)).toEqual(["C", "A"]);
  });
});

describe("mergeTrophies", () => {
  it("junta metadados com o status de conquista e a raridade", () => {
    const rows = mergeTrophies(
      [
        { trophyId: 0, trophyType: "platinum", trophyName: "Platina", trophyHidden: false },
        { trophyId: 1, trophyType: "bronze", trophyHidden: true },
      ],
      [
        { trophyId: 0, earned: true, earnedDateTime: daysAgo(1), trophyEarnedRate: "3.2" },
        { trophyId: 1, earned: false, trophyEarnedRate: "x" },
      ],
    );
    expect(rows[0]).toMatchObject({ id: 0, earned: true, earnedAt: daysAgo(1), rate: 3.2, name: "Platina" });
    expect(rows[1]).toMatchObject({ id: 1, earned: false, earnedAt: null, rate: null, name: "Troféu oculto", hidden: true });
  });
});

describe("feedItemsFromTrophies + sortFeed", () => {
  it("gera itens só para troféus conquistados na janela e ordena do mais novo", () => {
    const source = { owner: owner("f1"), title: title("G", daysAgo(1)) };
    const trophies = mergeTrophies(
      [
        { trophyId: 0, trophyType: "platinum", trophyName: "P", trophyHidden: false },
        { trophyId: 1, trophyType: "gold", trophyName: "O", trophyHidden: false },
        { trophyId: 2, trophyType: "bronze", trophyName: "B", trophyHidden: false },
      ],
      [
        { trophyId: 0, earned: true, earnedDateTime: daysAgo(1) },
        { trophyId: 1, earned: true, earnedDateTime: daysAgo(60) },
        { trophyId: 2, earned: true, earnedDateTime: daysAgo(3) },
      ],
    );
    const items = feedItemsFromTrophies(source, trophies, NOW);
    expect(items.map((i) => i.trophy.id)).toEqual([0, 2]);
    const sorted = sortFeed([...items].reverse().concat(items));
    expect(sorted.map((i) => i.key)).toEqual(["f1:G:0", "f1:G:2"]);
  });
});
