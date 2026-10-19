/**
 * Servidor dos recursos online do Plathunt (Cloudflare Worker + banco D1).
 *
 * - POST /v1/login: confirma o ID da PSN com o token da própria sessão PSN do
 *   usuário (perguntando à Sony quem é o dono; o token não é guardado) e
 *   devolve uma sessão assinada para esse ID.
 * - Todas as outras rotas exigem a sessão e só leem e gravam os dados de quem
 *   está logado: ninguém curte, pede boost ou responde em nome de outro.
 */
import { SESSION_SECONDS, signSession, verifySession, type Session } from "./session";

/** O mínimo do D1 que o Worker usa (os testes usam um SQLite com a mesma forma). */
export interface Statement {
  bind(...values: unknown[]): Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}

export interface Env {
  DB: Database;
  /** Chave das sessões (segredo do Worker, criado pelo deploy). */
  SESSION_SECRET: string;
}

const PSN = "https://m.np.playstation.com/api";
/** Pedidos de boost por jogador por hora (evita spam). */
export const BOOST_LIMIT_PER_HOUR = 30;
const MAX_BOOST_RECIPIENTS = 50;
const MAX_PAYLOAD_CHARS = 8000;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const isAccountId = (v: unknown): v is string => typeof v === "string" && /^\d{1,32}$/.test(v);
const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 16_000) throw new HttpError(413, "body");
  try {
    const body = JSON.parse(text || "{}");
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, "body");
}

async function psn(path: string, token: string, fetcher: typeof fetch) {
  const res = await fetcher(`${PSN}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new HttpError(401, "psn");
  return res.json() as Promise<Record<string, unknown>>;
}

/** Login: quem é o dono do token, segundo a própria PSN. */
async function login(request: Request, env: Env, fetcher: typeof fetch) {
  const { psnToken } = await readBody(request);
  if (typeof psnToken !== "string" || psnToken.length < 20 || psnToken.length > 8000) throw new HttpError(400, "token");
  let accountId: string;
  let onlineId: string;
  let avatarUrl: string | null = null;
  try {
    accountId = String((await psn("/trophy/v1/users/me/trophySummary", psnToken, fetcher)).accountId);
    const profile = await psn(`/userProfile/v1/internal/users/${accountId}/profiles`, psnToken, fetcher);
    onlineId = String(profile.onlineId ?? "");
    const avatars = (profile.avatars ?? []) as { size?: string; url?: string }[];
    avatarUrl = (avatars.find((a) => a.size === "l") ?? avatars[0])?.url ?? null;
  } catch {
    throw new HttpError(401, "psn");
  }
  if (!isAccountId(accountId) || !onlineId) throw new HttpError(401, "psn");

  await env.DB.prepare(
    `insert into profiles (account_id, online_id, avatar_url, updated_at) values (?1, ?2, ?3, ?4)
     on conflict (account_id) do update set online_id = ?2, avatar_url = ?3, updated_at = ?4`,
  )
    .bind(accountId, onlineId, avatarUrl, new Date().toISOString())
    .run();

  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const token = await signSession({ sub: accountId, oid: onlineId, exp }, env.SESSION_SECRET);
  return json({ token, accountId, onlineId, expiresAt: exp * 1000 });
}

async function requireSession(request: Request, env: Env): Promise<Session> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = token ? await verifySession(token, env.SESSION_SECRET) : null;
  if (!session) throw new HttpError(401, "session");
  return session;
}

/** Nomes (onlineId) dos usuários do app, por accountId. */
async function profiles(request: Request, env: Env) {
  const { ids } = await readBody(request);
  if (!Array.isArray(ids) || ids.length > 200 || !ids.every(isAccountId)) throw new HttpError(400, "ids");
  const found: { account_id: string; online_id: string }[] = [];
  // O D1 aceita até 100 valores por consulta.
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { results } = await env.DB.prepare(
      `select account_id, online_id from profiles where account_id in (${chunk.map(() => "?").join(",")})`,
    )
      .bind(...chunk)
      .all<{ account_id: string; online_id: string }>();
    found.push(...results);
  }
  return json({ profiles: found });
}

/** Curte (ou desfaz) em nome próprio. */
async function like(request: Request, env: Env, me: Session) {
  const { item_key, owner_account_id, reaction, on } = await readBody(request);
  if (!isText(item_key, 200) || !isAccountId(owner_account_id) || !isText(reaction, 16)) throw new HttpError(400, "like");
  if (owner_account_id === me.sub) throw new HttpError(400, "own");
  if (on === false) {
    await env.DB.prepare("delete from likes where item_key = ?1 and liker_account_id = ?2 and reaction = ?3")
      .bind(item_key, me.sub, reaction)
      .run();
  } else {
    await env.DB.prepare(
      `insert into likes (item_key, owner_account_id, liker_account_id, reaction, created_at)
       values (?1, ?2, ?3, ?4, ?5) on conflict do nothing`,
    )
      .bind(item_key, owner_account_id, me.sub, reaction, new Date().toISOString())
      .run();
  }
  return json({ ok: true });
}

/** Curtidas de todos os usuários do app nestas conquistas. */
async function likesFor(request: Request, env: Env) {
  const { keys } = await readBody(request);
  if (!Array.isArray(keys) || keys.length > 100 || !keys.every((k) => isText(k, 200))) throw new HttpError(400, "keys");
  if (!keys.length) return json({ likes: [] });
  const { results } = await env.DB.prepare(
    `select item_key, owner_account_id, liker_account_id, reaction, created_at from likes
     where item_key in (${keys.map(() => "?").join(",")})`,
  )
    .bind(...keys)
    .all();
  return json({ likes: results });
}

/** Curtidas que os outros deram nas minhas conquistas desde `since`. */
async function likesOnMine(url: URL, env: Env, me: Session) {
  const since = url.searchParams.get("since") ?? "";
  if (Number.isNaN(Date.parse(since))) throw new HttpError(400, "since");
  const { results } = await env.DB.prepare(
    `select l.item_key, l.owner_account_id, l.liker_account_id, l.reaction, l.created_at, p.online_id
     from likes l left join profiles p on p.account_id = l.liker_account_id
     where l.owner_account_id = ?1 and l.created_at > ?2
     order by l.created_at desc limit 20`,
  )
    .bind(me.sub, new Date(since).toISOString())
    .all();
  return json({ likes: results });
}

/** Envia o pedido de boost para amigos que usam o app (com limite por hora). */
async function sendBoosts(request: Request, env: Env, me: Session) {
  const { to, payload } = await readBody(request);
  if (!Array.isArray(to) || !to.length || to.length > MAX_BOOST_RECIPIENTS || !to.every(isAccountId)) {
    throw new HttpError(400, "to");
  }
  const recipients = [...new Set(to)].filter((id) => id !== me.sub);
  const text = JSON.stringify(payload ?? null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || text.length > MAX_PAYLOAD_CHARS) {
    throw new HttpError(400, "payload");
  }
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const recent = await env.DB.prepare(
    "select count(*) as n from boost_requests where from_account_id = ?1 and created_at > ?2",
  )
    .bind(me.sub, hourAgo)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) + recipients.length > BOOST_LIMIT_PER_HOUR) throw new HttpError(429, "limit");

  const now = new Date().toISOString();
  const insert = env.DB.prepare(
    "insert into boost_requests (id, from_account_id, to_account_id, payload, status, created_at) values (?1, ?2, ?3, ?4, 'novo', ?5)",
  );
  if (recipients.length) await env.DB.batch(recipients.map((id) => insert.bind(crypto.randomUUID(), me.sub, id, text, now)));
  return json({ count: recipients.length });
}

/** Pedidos que enviei ou recebi, com o nome confirmado de quem enviou. */
async function myBoosts(env: Env, me: Session) {
  const { results } = await env.DB.prepare(
    `select b.id, b.from_account_id, b.to_account_id, b.payload, b.status, b.created_at, p.online_id as from_online_id
     from boost_requests b left join profiles p on p.account_id = b.from_account_id
     where b.from_account_id = ?1 or b.to_account_id = ?1
     order by b.created_at desc limit 100`,
  )
    .bind(me.sub)
    .all<{ payload: string } & Record<string, unknown>>();
  return json({
    requests: results.map((r) => {
      let payload: unknown = {};
      try {
        payload = JSON.parse(r.payload);
      } catch {}
      return { ...r, payload };
    }),
  });
}

/** Só quem recebeu o pedido responde (aceito/recusado). */
async function answerBoost(request: Request, env: Env, me: Session) {
  const { id, status } = await readBody(request);
  if (!isText(id, 64) || (status !== "aceito" && status !== "recusado")) throw new HttpError(400, "answer");
  const { meta } = await env.DB.prepare("update boost_requests set status = ?1 where id = ?2 and to_account_id = ?3")
    .bind(status, id, me.sub)
    .run();
  if (!meta.changes) throw new HttpError(404, "request");
  return json({ ok: true });
}

/** Apaga tudo o que o servidor guarda sobre o jogador (perfil, curtidas e pedidos). */
async function deleteAccount(env: Env, me: Session) {
  await env.DB.batch([
    env.DB.prepare("delete from likes where liker_account_id = ?1 or owner_account_id = ?1").bind(me.sub),
    env.DB.prepare("delete from boost_requests where from_account_id = ?1 or to_account_id = ?1").bind(me.sub),
    env.DB.prepare("delete from profiles where account_id = ?1").bind(me.sub),
  ]);
  return json({ ok: true });
}

export async function handle(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  try {
    if (route === "POST /v1/login") return await login(request, env, fetcher);
    if (route === "GET /v1/health") return json({ ok: true });

    const me = await requireSession(request, env);
    switch (route) {
      case "POST /v1/profiles":
        return await profiles(request, env);
      case "POST /v1/likes":
        return await like(request, env, me);
      case "POST /v1/likes/query":
        return await likesFor(request, env);
      case "GET /v1/likes/mine":
        return await likesOnMine(url, env, me);
      case "POST /v1/boosts":
        return await sendBoosts(request, env, me);
      case "GET /v1/boosts":
        return await myBoosts(env, me);
      case "POST /v1/boosts/answer":
        return await answerBoost(request, env, me);
      case "POST /v1/account/delete":
        return await deleteAccount(env, me);
    }
    throw new HttpError(404, "route");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    // Nada do pedido (nem tokens) vai para o log: só o tipo do erro.
    console.error("erro interno", e instanceof Error ? e.name : "desconhecido");
    return json({ error: "internal" }, 500);
  }
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
