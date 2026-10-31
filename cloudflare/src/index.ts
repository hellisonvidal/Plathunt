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

  // Quem bloqueou o remetente não recebe mais pedidos dele.
  const blockedBy = await env.DB.prepare("select blocker_account_id from blocks where blocked_account_id = ?1")
    .bind(me.sub)
    .all<{ blocker_account_id: string }>();
  const blockers = new Set(blockedBy.results.map((r) => r.blocker_account_id));
  for (let i = recipients.length - 1; i >= 0; i--) if (blockers.has(recipients[i])) recipients.splice(i, 1);

  // O mesmo pedido (boostId) não vai duas vezes para a mesma pessoa (toque
  // duplo, nova tentativa depois de falha de rede, os dois seletores da tela).
  const boostId = typeof (payload as { boostId?: unknown }).boostId === "string" ? (payload as { boostId: string }).boostId : null;
  if (boostId) {
    const { results } = await env.DB.prepare(
      "select to_account_id from boost_requests where from_account_id = ?1 and json_extract(payload, '$.boostId') = ?2",
    )
      .bind(me.sub, boostId)
      .all<{ to_account_id: string }>();
    const already = new Set(results.map((r) => r.to_account_id));
    for (let i = recipients.length - 1; i >= 0; i--) if (already.has(recipients[i])) recipients.splice(i, 1);
  }

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
     where (b.from_account_id = ?1 or b.to_account_id = ?1)
       and not exists (select 1 from blocks k where k.blocker_account_id = ?1 and k.blocked_account_id = b.from_account_id)
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

const REPORT_REASONS = ["spam", "ofensivo", "outro"];

/**
 * POST /v1/reports: denúncia de um pedido de boost recebido (o recado é texto
 * livre de outro usuário). Só quem recebeu o pedido denuncia; o remetente
 * fica bloqueado para quem denunciou.
 */
async function reportBoost(request: Request, env: Env, me: Session) {
  const { request_id, reason } = await readBody(request);
  if (typeof request_id !== "string" || typeof reason !== "string" || !REPORT_REASONS.includes(reason)) {
    throw new HttpError(400, "report");
  }
  const row = await env.DB.prepare("select from_account_id from boost_requests where id = ?1 and to_account_id = ?2")
    .bind(request_id, me.sub)
    .first<{ from_account_id: string }>();
  if (!row) throw new HttpError(404, "request");
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "insert into reports (id, reporter_account_id, reported_account_id, request_id, reason, created_at) values (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(crypto.randomUUID(), me.sub, row.from_account_id, request_id, reason, now),
    env.DB.prepare(
      "insert or ignore into blocks (blocker_account_id, blocked_account_id, created_at) values (?1, ?2, ?3)",
    ).bind(me.sub, row.from_account_id, now),
    env.DB.prepare("update boost_requests set status = 'recusado' where id = ?1").bind(request_id),
  ]);
  return json({ ok: true });
}

/** POST /v1/blocks: bloqueia (ou desbloqueia) um jogador para não receber mais pedidos dele. */
async function setBlock(request: Request, env: Env, me: Session) {
  const { account_id, on } = await readBody(request);
  if (!isAccountId(account_id) || account_id === me.sub) throw new HttpError(400, "account_id");
  if (on === false) {
    await env.DB.prepare("delete from blocks where blocker_account_id = ?1 and blocked_account_id = ?2")
      .bind(me.sub, account_id)
      .run();
  } else {
    await env.DB.prepare("insert or ignore into blocks (blocker_account_id, blocked_account_id, created_at) values (?1, ?2, ?3)")
      .bind(me.sub, account_id, new Date().toISOString())
      .run();
  }
  return json({ ok: true });
}

/** Apaga tudo o que o servidor guarda sobre o jogador (perfil, curtidas e pedidos). */
async function deleteAccount(env: Env, me: Session) {
  await env.DB.batch([
    env.DB.prepare("delete from likes where liker_account_id = ?1 or owner_account_id = ?1").bind(me.sub),
    env.DB.prepare("delete from boost_requests where from_account_id = ?1 or to_account_id = ?1").bind(me.sub),
    env.DB.prepare("delete from invites where from_account_id = ?1").bind(me.sub),
    env.DB.prepare("delete from reports where reporter_account_id = ?1").bind(me.sub),
    env.DB.prepare("delete from blocks where blocker_account_id = ?1 or blocked_account_id = ?1").bind(me.sub),
    env.DB.prepare("delete from profiles where account_id = ?1").bind(me.sub),
  ]);
  return json({ ok: true });
}

/** Convites com link curto por jogador por hora. */
export const INVITE_LIMIT_PER_HOUR = 60;
const INVITE_ID = /^[A-Za-z0-9]{6,12}$/;

function newInviteId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}

/** POST /v1/invites: guarda o pedido e devolve o código do link curto. */
async function createInvite(request: Request, env: Env, me: Session) {
  const { payload } = await readBody(request);
  const text = JSON.stringify(payload ?? null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || text.length > MAX_PAYLOAD_CHARS) {
    throw new HttpError(400, "payload");
  }
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const recent = await env.DB.prepare("select count(*) as n from invites where from_account_id = ?1 and created_at > ?2")
    .bind(me.sub, hourAgo)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= INVITE_LIMIT_PER_HOUR) throw new HttpError(429, "limit");
  // O nome de quem convida vem da sessão (confirmado pela PSN), não do pedido.
  const stored = JSON.stringify({ ...(payload as Record<string, unknown>), from: me.oid });
  const id = newInviteId();
  await env.DB.prepare("insert into invites (id, from_account_id, payload, created_at) values (?1, ?2, ?3, ?4)")
    .bind(id, me.sub, stored, new Date().toISOString())
    .run();
  return json({ id });
}

/** Texto em base64url (o formato do link plathunt://boost?d=…). */
function toBase64Url(text: string): string {
  let bin = "";
  new TextEncoder().encode(text).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** GET /c/<id>: o link curto do WhatsApp; mostra a mesma página do convite. */
async function shortInvite(id: string, env: Env): Promise<Response> {
  if (!INVITE_ID.test(id)) return new Response("Convite inválido.", { status: 404 });
  const row = await env.DB.prepare("select payload from invites where id = ?1").bind(id).first<{ payload: string }>();
  if (!row) return new Response("Convite não encontrado.", { status: 404 });
  return invitePage(new URL(`https://x/convite?d=${toBase64Url(row.payload)}`));
}

const PLAY_STORE = "https://play.google.com/store/apps/details?id=app.plathunt.trophytracker";
const APP_PACKAGE = "app.plathunt.trophytracker";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Jogo do pedido (só para mostrar na página); qualquer erro vira "". */
function inviteGame(code: string): string {
  try {
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes)) as { from?: unknown; game?: { name?: unknown } };
    const game = typeof p.game?.name === "string" ? p.game.name.slice(0, 120) : "";
    const from = typeof p.from === "string" ? p.from.slice(0, 32) : "";
    return game ? (from ? `${from} · ${game}` : game) : "";
  } catch {
    return "";
  }
}

/**
 * GET /convite?d=…: link de convite de boost mandado no WhatsApp (os apps de
 * mensagem só deixam tocar em links https). No Android, abre o pedido no
 * Plathunt; sem o app, o próprio Android leva para a Play Store. A página
 * também tem os dois botões, para outros aparelhos.
 */
function invitePage(url: URL): Response {
  const code = url.searchParams.get("d") ?? "";
  if (!/^[A-Za-z0-9_-]{1,8000}$/.test(code)) return new Response("Convite inválido.", { status: 400 });
  const appLink = `plathunt://boost?d=${code}`;
  const intent = `intent://boost?d=${code}#Intent;scheme=plathunt;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE)};end`;
  const game = escapeHtml(inviteGame(code));
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Convite de boost · Plathunt</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#0b0d12;color:#e8ecf3;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{max-width:420px;padding:24px;text-align:center}h1{font-size:1.4rem}p{color:#9aa4b5}
a{display:block;margin:12px 0;padding:14px;border-radius:14px;font-weight:600;text-decoration:none;color:#fff;background:#0070d1}
a.alt{background:#1c2230;border:1px solid #2c3446}</style></head>
<body><main><h1>📣 Convite de boost</h1>${game ? `<p>${game}</p>` : ""}
<p>Responda sim ou não pelo Plathunt.</p>
<a href="${escapeHtml(appLink)}">Abrir no Plathunt</a>
<a class="alt" href="${PLAY_STORE}">Instalar o Plathunt (Google Play)</a>
</main><script>if(/Android/i.test(navigator.userAgent))location.href=${JSON.stringify(intent)};</script></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function handle(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  try {
    if (route === "POST /v1/login") return await login(request, env, fetcher);
    if (route === "GET /v1/health") return json({ ok: true });
    if (route === "GET /convite") return invitePage(url);
    if (request.method === "GET" && url.pathname.startsWith("/c/")) return await shortInvite(url.pathname.slice(3), env);

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
      case "POST /v1/invites":
        return await createInvite(request, env, me);
      case "POST /v1/boosts":
        return await sendBoosts(request, env, me);
      case "GET /v1/boosts":
        return await myBoosts(env, me);
      case "POST /v1/boosts/answer":
        return await answerBoost(request, env, me);
      case "POST /v1/reports":
        return await reportBoost(request, env, me);
      case "POST /v1/blocks":
        return await setBlock(request, env, me);
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
