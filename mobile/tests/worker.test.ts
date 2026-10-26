import { beforeEach, describe, expect, it } from "vitest";
import { BOOST_LIMIT_PER_HOUR, handle, type Env } from "../../cloudflare/src/index";
import { signSession } from "../../cloudflare/src/session";
import { fakePsn, freshDatabase, SECRET } from "./helpers/worker";

// O servidor (Cloudflare Worker) roda aqui contra um SQLite de verdade, com
// as mesmas migrações do D1.
let env: Env;
const call = (method: string, path: string, body?: unknown, token?: string) =>
  handle(
    new Request(`https://api.test${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    fakePsn,
  );
const login = async (psnToken: string) => ((await (await call("POST", "/v1/login", { psnToken })).json()) as { token: string }).token;

beforeEach(() => {
  env = { DB: freshDatabase(), SESSION_SECRET: SECRET };
});

describe("servidor dos recursos online (Cloudflare)", () => {
  it("o login confirma o ID com a PSN e recusa token inválido", async () => {
    const ok = await call("POST", "/v1/login", { psnToken: "token-da-ana-xxxxxxxxxxxxxxxx" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ accountId: "111", onlineId: "Ana" });
    expect((await call("POST", "/v1/login", { psnToken: "token-falso-xxxxxxxxxxxxxxxxxx" })).status).toBe(401);
  });

  it("sem sessão válida nada funciona (forjada, adulterada ou vencida)", async () => {
    expect((await call("GET", "/v1/boosts")).status).toBe(401);
    const forged = await signSession({ sub: "111", oid: "Ana", exp: 9e9 }, "outra-chave-qualquer-com-32-caracteres!!");
    expect((await call("GET", "/v1/boosts", undefined, forged)).status).toBe(401);
    const ana = await login("token-da-ana-xxxxxxxxxxxxxxxx");
    const [h, , s] = ana.split(".");
    const tampered = `${h}.${btoa(JSON.stringify({ sub: "222", oid: "Bruno", exp: 9e9 })).replace(/=+$/, "")}.${s}`;
    expect((await call("GET", "/v1/boosts", undefined, tampered)).status).toBe(401);
    const expired = await signSession({ sub: "111", oid: "Ana", exp: 1 }, SECRET);
    expect((await call("GET", "/v1/boosts", undefined, expired)).status).toBe(401);
  });

  it("curtidas só em nome próprio", async () => {
    const ana = await login("token-da-ana-xxxxxxxxxxxxxxxx");
    const bruno = await login("token-do-bruno-xxxxxxxxxxxxxx");
    // Mesmo mandando outro liker no corpo, a curtida é de quem está logado.
    await call("POST", "/v1/likes", { item_key: "k1", owner_account_id: "222", reaction: "🔥", liker_account_id: "333" }, ana);
    expect((await call("POST", "/v1/likes", { item_key: "k1", owner_account_id: "111", reaction: "🔥" }, ana)).status).toBe(400);
    const { likes } = (await (await call("POST", "/v1/likes/query", { keys: ["k1"] }, bruno)).json()) as { likes: { liker_account_id: string }[] };
    expect(likes).toEqual([expect.objectContaining({ liker_account_id: "111" })]);
    const mine = (await (await call("GET", "/v1/likes/mine?since=2000-01-01T00:00:00Z", undefined, bruno)).json()) as { likes: { online_id: string }[] };
    expect(mine.likes[0].online_id).toBe("Ana");
    // Bruno não consegue desfazer a curtida da Ana.
    await call("POST", "/v1/likes", { item_key: "k1", owner_account_id: "222", reaction: "🔥", on: false }, bruno);
    expect(((await (await call("POST", "/v1/likes/query", { keys: ["k1"] }, ana)).json()) as { likes: unknown[] }).likes).toHaveLength(1);
  });

  it("pedidos de boost: só remetente e destinatário veem, só o destinatário responde, nome confirmado", async () => {
    const ana = await login("token-da-ana-xxxxxxxxxxxxxxxx");
    const bruno = await login("token-do-bruno-xxxxxxxxxxxxxx");
    const carla = await login("token-da-carla-xxxxxxxxxxxxxx");
    await call("POST", "/v1/boosts", { to: ["222"], payload: { from: "Carla", game: { name: "Jogo" } } }, ana);
    type List = { requests: { id: string; from_online_id: string; payload: { from: string } }[] };
    const got = (await (await call("GET", "/v1/boosts", undefined, bruno)).json()) as List;
    expect(got.requests).toHaveLength(1);
    // O texto dizia "Carla", mas quem enviou de fato foi a Ana.
    expect(got.requests[0].from_online_id).toBe("Ana");
    expect(((await (await call("GET", "/v1/boosts", undefined, carla)).json()) as List).requests).toHaveLength(0);
    const id = got.requests[0].id;
    expect((await call("POST", "/v1/boosts/answer", { id, status: "aceito" }, carla)).status).toBe(404);
    expect((await call("POST", "/v1/boosts/answer", { id, status: "aceito" }, ana)).status).toBe(404);
    expect((await call("POST", "/v1/boosts/answer", { id, status: "aceito" }, bruno)).status).toBe(200);
  });

  it("limite de pedidos de boost por hora", async () => {
    const ana = await login("token-da-ana-xxxxxxxxxxxxxxxx");
    const to = Array.from({ length: BOOST_LIMIT_PER_HOUR }, (_, i) => String(1000 + i));
    expect((await call("POST", "/v1/boosts", { to, payload: { game: { name: "Jogo" } } }, ana)).status).toBe(200);
    expect((await call("POST", "/v1/boosts", { to: ["222"], payload: { game: { name: "Jogo" } } }, ana)).status).toBe(429);
  });

  it("apagar meus dados remove perfil, curtidas e pedidos", async () => {
    const ana = await login("token-da-ana-xxxxxxxxxxxxxxxx");
    const bruno = await login("token-do-bruno-xxxxxxxxxxxxxx");
    await call("POST", "/v1/likes", { item_key: "k1", owner_account_id: "222", reaction: "🔥" }, ana);
    await call("POST", "/v1/boosts", { to: ["222"], payload: { game: { name: "Jogo" } } }, ana);
    expect((await call("POST", "/v1/account/delete", {}, ana)).status).toBe(200);
    expect(((await (await call("POST", "/v1/likes/query", { keys: ["k1"] }, bruno)).json()) as { likes: unknown[] }).likes).toHaveLength(0);
    expect(((await (await call("GET", "/v1/boosts", undefined, bruno)).json()) as { requests: unknown[] }).requests).toHaveLength(0);
    expect(((await (await call("POST", "/v1/profiles", { ids: ["111"] }, bruno)).json()) as { profiles: unknown[] }).profiles).toHaveLength(0);
  });
});

describe("convite de boost (link do WhatsApp)", () => {
  it("abre o app no Android e oferece a Play Store", async () => {
    const payload = btoa(JSON.stringify({ from: "Ana", game: { name: "<b>Jogo</b>" } })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const res = await call("GET", `/convite?d=${payload}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain(`plathunt://boost?d=${payload}`);
    expect(html).toContain("intent://boost?d=");
    expect(html).toContain("play.google.com/store/apps/details?id=app.plathunt.trophytracker");
    expect(html).toContain("Ana · &lt;b&gt;Jogo&lt;/b&gt;");
    expect(html).not.toContain("<b>Jogo</b>");
  });

  it("recusa código inválido", async () => {
    expect((await call("GET", "/convite?d=%3Cscript%3E")).status).toBe(400);
  });
});

describe("convite com link curto e pedidos sem duplicidade", () => {
  it("guarda o convite e o link curto abre a página do convite com o nome confirmado", async () => {
    const ana = await login("token-da-ana-xxxxxxxxxxxxxxxx");
    const res = await call("POST", "/v1/invites", { payload: { from: "Falso", game: { name: "Jogo X" }, trophies: [] } }, ana);
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/^[A-Za-z0-9]{7}$/);
    const page = await call("GET", `/c/${id}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Ana · Jogo X");
    expect(html).toContain("plathunt://boost?d=");
    expect((await call("GET", "/c/naoexiste1")).status).toBe(404);
    expect((await call("POST", "/v1/invites", { payload: {} })).status).toBe(401);
  });

  it("o mesmo pedido não vai duas vezes para a mesma pessoa", async () => {
    const ana = await login("token-da-ana-xxxxxxxxxxxxxxxx");
    const payload = { boostId: "b-1", game: { name: "Jogo" }, trophies: [] };
    expect(await (await call("POST", "/v1/boosts", { to: ["222"], payload }, ana)).json()).toEqual({ count: 1 });
    expect(await (await call("POST", "/v1/boosts", { to: ["222", "222"], payload }, ana)).json()).toEqual({ count: 0 });
    expect(await (await call("POST", "/v1/boosts", { to: ["222"], payload: { ...payload, boostId: "b-2" } }, ana)).json()).toEqual({ count: 1 });
    const { requests } = (await (await call("GET", "/v1/boosts", undefined, ana)).json()) as { requests: unknown[] };
    expect(requests).toHaveLength(2);
  });
});
