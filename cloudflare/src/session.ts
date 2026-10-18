/**
 * Sessão dos recursos online: um token assinado (HMAC-SHA256, formato JWT)
 * com o accountId da PSN confirmado no login. Só o Worker conhece a chave
 * (segredo SESSION_SECRET), então ninguém consegue forjar a sessão de outro.
 */
export interface Session {
  /** accountId da PSN. */
  sub: string;
  /** Nome na PSN (onlineId) no momento do login. */
  oid: string;
  /** Validade (segundos desde 1970). */
  exp: number;
}

/** Validade da sessão: depois disso o app confirma a conta na PSN de novo. */
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const encodeJson = (value: unknown) => toBase64Url(encoder.encode(JSON.stringify(value)));

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error("SESSION_SECRET ausente ou curto demais.");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(session: Session, secret: string): Promise<string> {
  const data = `${encodeJson({ alg: "HS256", typ: "JWT" })}.${encodeJson(session)}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(data));
  return `${data}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Sessão do token, ou null se a assinatura não confere ou ela venceu. */
export async function verifySession(token: string, secret: string, now = Date.now()): Promise<Session | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  try {
    // crypto.subtle.verify compara a assinatura em tempo constante.
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(`${header}.${payload}`),
    );
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Session;
    if (typeof session.sub !== "string" || typeof session.exp !== "number") return null;
    return session.exp * 1000 > now ? session : null;
  } catch {
    return null;
  }
}
