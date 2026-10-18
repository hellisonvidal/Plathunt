/**
 * Cache (memória + celular) para não repetir chamadas à PSN e à loja a cada
 * troca de tela. As chaves já incluem a conta logada. O que é pequeno fica no
 * localStorage; o que é grande (catálogo da loja, listas de milhares de
 * jogos) fica no IndexedDB, que aguenta bem mais e sobrevive ao fechar o app.
 */
import { idbClear, idbDelete, idbGet, idbSet } from "./idb";

const PREFIX = "tm.cache.";
/** Acima disso (caracteres de JSON), vai para o IndexedDB. */
const LARGE = 200_000;

export interface CacheEntry {
  at: number;
  value: unknown;
}

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function readLocal(key: string): CacheEntry | undefined {
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    memory.set(key, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

async function read(key: string): Promise<CacheEntry | undefined> {
  const local = readLocal(key);
  if (local) return local;
  const stored = await idbGet<CacheEntry>(PREFIX + key);
  if (stored && typeof stored.at === "number") {
    memory.set(key, stored);
    return stored;
  }
  return undefined;
}

function write(key: string, value: unknown) {
  const entry = { at: Date.now(), value };
  memory.set(key, entry);
  let json = "";
  try {
    json = JSON.stringify(entry);
  } catch {
    return;
  }
  if (json.length <= LARGE) {
    try {
      localStorage.setItem(PREFIX + key, json);
      void idbDelete(PREFIX + key);
      return;
    } catch {
      // localStorage cheio: segue para o IndexedDB.
    }
  }
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
  void idbSet(PREFIX + key, entry);
}

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, force = false): Promise<T> {
  const hit = force ? undefined : await read(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = load()
    .then((value) => {
      write(key, value);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** O que estiver salvo para a chave, mesmo vencido (para mostrar na hora enquanto atualiza). */
export async function peekCached<T>(key: string): Promise<{ at: number; value: T } | undefined> {
  return (await read(key)) as { at: number; value: T } | undefined;
}

export function clearCache() {
  memory.clear();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {}
  void idbClear();
}

/** Limita quantas tarefas rodam ao mesmo tempo (para não estourar o rate limit da PSN). */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

/** Executa `fn` em cada item com no máximo `limit` chamadas simultâneas. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
