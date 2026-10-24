import type { Title } from "../psn/types";

/** Jogos pedidos por vez na atualização incremental. */
export const DELTA_PAGE = 100;
/** Acima disso mudou muita coisa: vale mais baixar a lista inteira de uma vez. */
const MAX_DELTA_PAGES = 4;

export interface TitlesPage {
  titles: Title[];
  nextOffset?: number;
  total: number;
}

/**
 * Atualização incremental da lista de jogos: a PSN devolve os jogos do mais
 * recente para o mais antigo (pela última conquista), então basta baixar o
 * começo da lista até achar um jogo que não mudou desde a cópia salva e
 * juntar com o resto dela. Em vez de milhares de jogos, em geral vem uma
 * página de 100.
 *
 * Devolve null quando não dá para confiar no resultado (mudou muita coisa,
 * ou jogos foram escondidos ou reapareceram) e a lista inteira precisa ser
 * baixada de novo.
 */
export async function syncTitles(saved: Title[], fetchPage: (offset: number) => Promise<TitlesPage>): Promise<Title[] | null> {
  const before = new Map(saved.map((t) => [t.id, t.lastUpdated]));
  const fresh: Title[] = [];
  let offset = 0;
  let total = -1;
  for (let page = 0; page < MAX_DELTA_PAGES; page++) {
    const res = await fetchPage(offset);
    total = res.total;
    for (const title of res.titles) {
      if (before.get(title.id) === title.lastUpdated) {
        const ids = new Set(fresh.map((t) => t.id));
        const merged = [...fresh, ...saved.filter((t) => !ids.has(t.id))];
        return merged.length === total ? merged : null;
      }
      fresh.push(title);
    }
    if (res.nextOffset === undefined || res.titles.length === 0) {
      // A lista acabou antes de achar um jogo igual: a lista nova é esta.
      return fresh.length === total ? fresh : null;
    }
    offset = res.nextOffset;
  }
  return null;
}
