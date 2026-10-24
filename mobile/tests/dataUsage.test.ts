import { describe, expect, it } from "vitest";
import { syncTitles, type TitlesPage } from "../src/lib/titleSync";
import { resizedStoreImage, imageCandidates } from "../src/lib/images";
import type { Title } from "../src/psn/types";

const title = (id: string, lastUpdated: string, progress = 10): Title => ({
  id,
  service: "trophy2",
  name: id,
  iconUrl: null,
  platform: "PS5",
  progress,
  earned: { platinum: 0, gold: 0, silver: 0, bronze: 1 },
  defined: { platinum: 1, gold: 1, silver: 1, bronze: 10 },
  lastUpdated,
  hasGroups: false,
});

/** PSN falsa: devolve a lista em páginas, do mais recente ao mais antigo, e conta os pedidos. */
function psn(list: Title[], pageSize = 2) {
  const calls: number[] = [];
  const fetchPage = async (offset: number): Promise<TitlesPage> => {
    calls.push(offset);
    const titles = list.slice(offset, offset + pageSize);
    return { titles, nextOffset: offset + pageSize < list.length ? offset + pageSize : undefined, total: list.length };
  };
  return { fetchPage, calls };
}

const saved = [title("c", "2026-10-03"), title("b", "2026-10-02"), title("a", "2026-10-01")];

describe("lista de jogos incremental (menos dados)", () => {
  it("sem mudanças, baixa só a primeira página e devolve a lista salva", async () => {
    const { fetchPage, calls } = psn(saved);
    expect(await syncTitles(saved, fetchPage)).toEqual(saved);
    expect(calls).toEqual([0]);
  });

  it("um jogo com troféu novo sobe para o topo e o resto vem da cópia salva", async () => {
    const now = [title("a", "2026-10-10", 50), title("c", "2026-10-03"), title("b", "2026-10-02")];
    const { fetchPage, calls } = psn(now);
    expect(await syncTitles(saved, fetchPage)).toEqual(now);
    expect(calls).toEqual([0]);
  });

  it("jogo novo entra no topo", async () => {
    const now = [title("d", "2026-10-11"), ...saved];
    const { fetchPage } = psn(now);
    expect((await syncTitles(saved, fetchPage))?.map((t) => t.id)).toEqual(["d", "c", "b", "a"]);
  });

  it("jogo escondido ou que reapareceu: pede a lista inteira (null)", async () => {
    const hidden = [title("c", "2026-10-03"), title("a", "2026-10-01")];
    expect(await syncTitles(saved, psn(hidden).fetchPage)).toBeNull();
  });

  it("mudou demais: pede a lista inteira (null)", async () => {
    const many = Array.from({ length: 20 }, (_, i) => title(`n${i}`, `2026-11-${String(20 - i).padStart(2, "0")}`));
    expect(await syncTitles(saved, psn([...many, ...saved]).fetchPage)).toBeNull();
  });
});

describe("imagens da loja no tamanho da tela", () => {
  const url = "https://image.api.playstation.com/vulcan/ap/rnd/202010/2915/capa.png";

  it("pede a largura certa (em degraus) e mantém a original como reserva", () => {
    expect(resizedStoreImage(url, 220, 2)).toBe(`${url}?w=440`);
    expect(resizedStoreImage(url, 220, 3)).toBe(`${url}?w=560`);
    expect(imageCandidates(url, 220)).toEqual([resizedStoreImage(url, 220), url]);
  });

  it("não mexe em imagens de outros servidores nem em endereços que já têm parâmetros", () => {
    expect(resizedStoreImage("https://psnobj.prod.dl.playstation.net/x.png", 100, 2)).toBeNull();
    expect(resizedStoreImage(`${url}?w=100`, 220, 2)).toBeNull();
    expect(imageCandidates("https://psnobj.prod.dl.playstation.net/x.png", 100)).toHaveLength(1);
  });
});
