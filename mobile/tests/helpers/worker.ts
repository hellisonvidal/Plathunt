import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Database, Statement } from "../../../cloudflare/src/index";

// O servidor (Cloudflare Worker) roda nos testes contra um SQLite de verdade,
// com as mesmas migrações do D1.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
// Todas as migrações, em ordem (0001_init.sql, 0002_invites.sql…).
const MIGRATIONS_DIR = new URL("../../../cloudflare/migrations/", import.meta.url);
const MIGRATION = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL(f, MIGRATIONS_DIR), "utf8"))
  .join("\n");
export const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";

type Sqlite = {
  prepare(sql: string): {
    all(...p: unknown[]): unknown[];
    get(...p: unknown[]): unknown;
    run(...p: unknown[]): { changes: number | bigint };
  };
  exec(sql: string): void;
};

/** Banco novo, vazio, com a mesma interface do D1. */
export function freshDatabase(): Database {
  const db = new DatabaseSync(":memory:") as Sqlite;
  db.exec(MIGRATION);
  const statement = (sql: string, params: unknown[] = []): Statement => ({
    bind: (...values) => statement(sql, values),
    all: async <T,>() => ({ results: db.prepare(sql).all(...params) as T[] }),
    first: async <T,>() => (db.prepare(sql).get(...params) as T | undefined) ?? null,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...params).changes) } }),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      db.exec("begin");
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        db.exec("commit");
        return out;
      } catch (e) {
        db.exec("rollback");
        throw e;
      }
    },
  };
}

/** PSN falsa: cada token de teste pertence a um jogador. */
export const PLAYERS: Record<string, { accountId: string; onlineId: string }> = {
  "token-da-ana-xxxxxxxxxxxxxxxx": { accountId: "111", onlineId: "Ana" },
  "token-do-bruno-xxxxxxxxxxxxxx": { accountId: "222", onlineId: "Bruno" },
  "token-da-carla-xxxxxxxxxxxxxx": { accountId: "333", onlineId: "Carla" },
};

export const fakePsn = (async (input: string | URL | Request, init?: RequestInit) => {
  const token = String(new Headers(init?.headers).get("Authorization")).replace("Bearer ", "");
  const player = PLAYERS[token];
  if (!player) return new Response("{}", { status: 401 });
  const url = String(input);
  if (url.endsWith("/trophy/v1/users/me/trophySummary")) return Response.json({ accountId: player.accountId });
  if (url.includes(`/users/${player.accountId}/profiles`)) return Response.json({ onlineId: player.onlineId, avatars: [] });
  return new Response("{}", { status: 404 });
}) as typeof fetch;
