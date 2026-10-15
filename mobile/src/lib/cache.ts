/**
 * Cache simples (memória + localStorage) para não repetir chamadas à PSN a
 * cada troca de tela. As chaves já incluem a conta logada.
 */
const PREFIX = "tm.cache.";
const memory = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function read(key: string): { at: number; value: unknown } | undefined {
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

function write(key: string, value: unknown) {
  const entry = { at: Date.now(), value };
  memory.set(key, entry);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Armazenamento cheio: fica só na memória.
  }
}

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, force = false): Promise<T> {
  const hit = read(key);
  if (!force && hit && Date.now() - hit.at < ttlMs) return hit.value as T;

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

export function clearCache() {
  memory.clear();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {}
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
