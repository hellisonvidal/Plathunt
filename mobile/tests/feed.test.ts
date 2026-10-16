import { describe, expect, it } from "vitest";
import { feedItemsFromTrophies, groupFeed, mergeTrophies, pickFeedSources, sortFeed, type FeedSource } from "../src/lib/feed";
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

describe("mergeTrophies com tradução", () => {
  it("guarda o nome original quando o nome foi traduzido", () => {
    const meta = [
      { trophyId: 0, trophyType: "bronze" as const, trophyName: "Pai e Filho", originalName: "Father and Son", trophyHidden: false },
      { trophyId: 1, trophyType: "gold" as const, trophyName: "Platina", originalName: "Platina", trophyHidden: false },
    ];
    const rows = mergeTrophies(meta, []);
    expect(rows[0]).toMatchObject({ name: "Pai e Filho", originalName: "Father and Son" });
    expect(rows[1].originalName).toBeUndefined();
  });
});

describe("Atividades: no mínimo 7 dias", () => {
  it("todos os jogos com troféus nos últimos 7 dias entram, mesmo passando do limite", () => {
    const sources: FeedSource[] = Array.from({ length: 30 }, (_, i) => ({
      owner: owner(`f${i}`),
      title: title(`R${i}`, daysAgo(1 + (i % 6))),
    }));
    sources.push({ owner: owner("old"), title: title("OLD", daysAgo(20)) });
    const picked = pickFeedSources(sources, NOW, 20, 30).map((s) => s.title.id);
    expect(picked).toHaveLength(30);
    expect(picked).not.toContain("OLD");
  });

  it("o limite vale para os jogos mais antigos que 7 dias", () => {
    const sources: FeedSource[] = [
      { owner: owner("a"), title: title("NEW", daysAgo(1)) },
      { owner: owner("b"), title: title("OLD1", daysAgo(10)) },
      { owner: owner("c"), title: title("OLD2", daysAgo(12)) },
    ];
    expect(pickFeedSources(sources, NOW, 2, 30).map((s) => s.title.id)).toEqual(["NEW", "OLD1"]);
  });

  it("sortFeed não corta troféus dos últimos 7 dias", () => {
    const source = { owner: owner("f"), title: title("G", daysAgo(1)) };
    const items = Array.from({ length: 120 }, (_, i) => ({
      key: `k${i}`,
      owner: source.owner,
      game: { id: "G", service: "trophy2" as const, name: "G", iconUrl: null, platform: "PS5" },
      trophy: { id: i, type: "bronze" as const, name: "t", detail: null, iconUrl: null },
      earnedAt: new Date(NOW - (i < 100 ? 2 : 20) * 86_400_000 - i * 1000).toISOString(),
      rate: null,
    }));
    expect(sortFeed(items, 80, NOW)).toHaveLength(100);
    expect(sortFeed(items.slice(100), 80, NOW)).toHaveLength(20);
  });
});

describe("groupFeed", () => {
  const item = (owner: string, game: string, id: number, hoursAgo: number, type: "platinum" | "gold" | "bronze" = "bronze") => ({
    key: `${owner}:${game}:${id}`,
    owner: { accountId: owner, onlineId: owner, avatarUrl: null, isMe: owner === "me" },
    game: { id: game, service: "trophy2" as const, name: game, iconUrl: null, platform: "PS5" },
    trophy: { id, type, name: `T${id}`, detail: null, iconUrl: null },
    earnedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
    rate: null,
  });

  it("junta jogador + jogo + dia em um grupo, do mais recente, com a contagem por tipo", () => {
    const groups = groupFeed([
      item("f1", "G", 1, 1, "gold"),
      item("f2", "H", 2, 2),
      item("f1", "G", 3, 1.5, "platinum"),
      item("f1", "G", 4, 72),
    ]);
    expect(groups.map((g) => [g.owner.accountId, g.game.id, g.items.length])).toEqual([
      ["f1", "G", 2],
      ["f2", "H", 1],
      ["f1", "G", 1],
    ]);
    expect(groups[0].counts).toEqual({ platinum: 1, gold: 1, silver: 0, bronze: 0 });
    expect(groups[0].items.map((i) => i.trophy.id)).toEqual([1, 3]);
  });
});
