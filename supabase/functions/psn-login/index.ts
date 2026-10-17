// Login do Trophy Mania: confirma o ID da PSN com o token da própria sessão
// PSN do usuário (lido só para isso, nunca guardado) e devolve uma sessão do
// Supabase ligada a esse ID. Assim ninguém consegue se passar por outro jogador.
import { createClient } from "npm:@supabase/supabase-js@2";

const PSN = "https://m.np.playstation.com/api";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function psn(path: string, token: string) {
  const res = await fetch(`${PSN}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`PSN ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let psnToken = "";
  try {
    psnToken = String((await req.json())?.psnToken ?? "");
  } catch {
    return json({ error: "body" }, 400);
  }
  if (psnToken.length < 20) return json({ error: "token" }, 400);

  // 1. Quem é o dono do token, segundo a própria PSN.
  let accountId: string;
  let onlineId: string;
  let avatarUrl: string | null = null;
  try {
    accountId = String((await psn("/trophy/v1/users/me/trophySummary", psnToken)).accountId);
    const profile = await psn(`/userProfile/v1/internal/users/${accountId}/profiles`, psnToken);
    onlineId = String(profile.onlineId);
    const avatars = (profile.avatars ?? []) as { size: string; url: string }[];
    avatarUrl = (avatars.find((a) => a.size === "l") ?? avatars[0])?.url ?? null;
  } catch {
    return json({ error: "psn" }, 401);
  }
  if (!/^\d+$/.test(accountId) || !onlineId) return json({ error: "psn" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const email = `${accountId}@psn.trophymania.invalid`;

  // 2. Usuário do Supabase para esse accountId (cria na primeira vez).
  const { data: existing } = await admin.from("profiles").select("user_id").eq("account_id", accountId).maybeSingle();
  let userId = existing?.user_id as string | undefined;
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { account_id: accountId, online_id: onlineId },
    });
    if (created.error || !created.data.user) return json({ error: "user" }, 500);
    userId = created.data.user.id;
  }
  const saved = await admin
    .from("profiles")
    .upsert({ account_id: accountId, user_id: userId, online_id: onlineId, avatar_url: avatarUrl, updated_at: new Date().toISOString() });
  if (saved.error) return json({ error: "profile" }, 500);

  // 3. Sessão: link de acesso gerado no servidor e trocado na hora (nenhum e-mail é enviado).
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return json({ error: "link" }, 500);
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const verified = await anon.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verified.error || !verified.data.session) return json({ error: "session" }, 500);

  return json({
    accessToken: verified.data.session.access_token,
    refreshToken: verified.data.session.refresh_token,
    accountId,
    onlineId,
  });
});
