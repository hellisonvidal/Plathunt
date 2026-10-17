import { describe, expect, it } from "vitest";
import { catalogProgress, loadCatalog } from "../src/lib/gameCatalog";
import type { Title } from "../src/psn/types";

const title = (id: string) => ({ id, name: id }) as Title;

describe("catálogo do Boost e dos Desafios", () => {
  it("carrega seus jogos, os dos amigos e a loja, uma vez só, avisando o progresso", async () => {
    let calls = 0;
    const loaders = {
      mine: async () => (calls++, [title("A")]),
      friendIds: async () => ["f1", "f2"],
      friendTitles: async (id: string) => [title(`${id}-game`)],
      store: async (onProgress: (l: never[], total: number) => void) => (onProgress([], 10), []),
    };
    const entry = loadCatalog("teste", loaders);
    expect(loadCatalog("teste", loaders)).toBe(entry);
    await new Promise<void>((resolve) => entry.listeners.add(() => entry.state.done && resolve()));
    expect(entry.state.mine).toHaveLength(1);
    expect(entry.state.friends.flat().map((t) => t.id).sort()).toEqual(["f1-game", "f2-game"]);
    expect(entry.state.friendsDone).toBe(2);
    expect(catalogProgress(entry.state)).toBe(100);
    expect(calls).toBe(1);
  });
});
