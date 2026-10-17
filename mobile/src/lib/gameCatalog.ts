import { useEffect, useState } from "react";
import { mapLimit } from "./cache";
import type { StoreProduct } from "./store";
import type { Title } from "../psn/types";

/**
 * Catálogo de jogos do Boost e dos Desafios: seus jogos, a lista completa de
 * jogos de cada amigo e a PlayStation Store inteira. É carregado uma vez (em
 * segundo plano, já ao abrir as Atividades) e compartilhado pelas telas, que
 * acompanham o progresso enquanto as partes chegam.
 */
export interface CatalogState {
  mine: Title[] | null;
  friends: Title[][];
  store: StoreProduct[];
  friendsDone: number;
  friendsTotal: number | null;
  storeLoaded: number;
  storeTotal: number | null;
  done: boolean;
}

export interface CatalogLoaders {
  mine: () => Promise<Title[]>;
  friendIds: () => Promise<string[]>;
  friendTitles: (id: string) => Promise<Title[]>;
  store: (onProgress: (loaded: StoreProduct[], total: number) => void) => Promise<StoreProduct[]>;
}

interface Entry {
  state: CatalogState;
  listeners: Set<() => void>;
  startedAt: number;
}

/** Depois disso o catálogo é recarregado na próxima vez que alguém pedir. */
const TTL_MS = 30 * 60_000;
/** Intervalo mínimo entre avisos de progresso (a lista pode ter milhares de jogos). */
const NOTIFY_MS = 400;
const entries = new Map<string, Entry>();

const EMPTY: CatalogState = {
  mine: null,
  friends: [],
  store: [],
  friendsDone: 0,
  friendsTotal: null,
  storeLoaded: 0,
  storeTotal: null,
  done: false,
};

/** Começa (ou reaproveita) o carregamento do catálogo identificado por `key`. */
export function loadCatalog(key: string, loaders: CatalogLoaders, force = false): Entry {
  const found = entries.get(key);
  if (found && !force && (!found.state.done || Date.now() - found.startedAt < TTL_MS)) return found;

  const entry: Entry = { state: { ...EMPTY }, listeners: found?.listeners ?? new Set(), startedAt: Date.now() };
  entries.set(key, entry);
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const notify = (now = false) => {
    if (entries.get(key) !== entry) return;
    const fire = () => {
      timer = null;
      last = Date.now();
      entry.listeners.forEach((l) => l());
    };
    if (now || Date.now() - last >= NOTIFY_MS) return fire();
    timer ??= setTimeout(fire, NOTIFY_MS);
  };
  const update = (patch: Partial<CatalogState>, now = false) => {
    entry.state = { ...entry.state, ...patch };
    notify(now);
  };

  const mine = loaders
    .mine()
    .catch(() => [] as Title[])
    .then((list) => update({ mine: list }, true));
  const friends = loaders
    .friendIds()
    .catch(() => [] as string[])
    .then(async (ids) => {
      update({ friendsTotal: ids.length });
      await mapLimit(ids, 8, async (id) => {
        const list = await loaders.friendTitles(id).catch(() => [] as Title[]);
        update({ friends: [...entry.state.friends, list], friendsDone: entry.state.friendsDone + 1 });
      });
    });
  const store = loaders
    .store((loaded, total) => update({ store: loaded, storeLoaded: loaded.length, storeTotal: total || null }))
    .catch(() => [] as StoreProduct[])
    .then((list) => update({ store: list, storeLoaded: list.length }));
  void Promise.all([mine, friends, store]).then(() => {
    if (timer) clearTimeout(timer);
    update({ done: true }, true);
  });
  return entry;
}

/** Estado do catálogo, atualizado enquanto carrega. */
export function useCatalog(key: string, loaders: () => CatalogLoaders): CatalogState & { reload: () => void } {
  const [, setTick] = useState(0);
  const [entry, setEntry] = useState(() => loadCatalog(key, loaders()));
  useEffect(() => {
    const current = loadCatalog(key, loaders());
    setEntry(current);
    const sync = () => setTick((n) => n + 1);
    current.listeners.add(sync);
    return () => void current.listeners.delete(sync);
    // `loaders` muda a cada render; o catálogo só depende da chave.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ...entry.state,
    reload: () => {
      const fresh = loadCatalog(key, loaders(), true);
      setEntry(fresh);
    },
  };
}

/** % geral do carregamento: seus jogos, amigos e loja. */
export function catalogProgress(s: CatalogState): number {
  const parts = [
    s.mine ? 1 : 0,
    s.friendsTotal === null ? 0 : s.friendsTotal === 0 ? 1 : s.friendsDone / s.friendsTotal,
    s.done ? 1 : s.storeTotal ? Math.min(1, s.storeLoaded / s.storeTotal) : 0,
  ];
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}
