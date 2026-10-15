import { exchangeAccessCodeForAuthTokens, exchangeRefreshTokenForAuthTokens, type AuthTokensResponse } from "psn-api";
import { clearCache } from "../lib/cache";
import { PsnLogin } from "./native";

/** Tokens OAuth da PSN, guardados só no celular. O NPSSO nunca é salvo. */
interface StoredSession {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

const KEY = "tm.session";

export class SessionExpired extends Error {
  constructor() {
    super("Sua sessão da PSN expirou. Entre novamente.");
  }
}

function load(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function save(tokens: AuthTokensResponse): StoredSession {
  if (!tokens.accessToken || !tokens.refreshToken) throw new Error("A PSN não devolveu os tokens.");
  const now = Date.now();
  const session = {
    accessToken: tokens.accessToken,
    accessExpiresAt: now + tokens.expiresIn * 1000,
    refreshToken: tokens.refreshToken,
    refreshExpiresAt: now + tokens.refreshTokenExpiresIn * 1000,
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function hasSession(): boolean {
  const s = load();
  return !!s && s.refreshExpiresAt > Date.now();
}

/** Login completo a partir do NPSSO: código OAuth (nativo) → tokens. */
export async function signInWithNpsso(npsso: string): Promise<void> {
  const { code } = await PsnLogin.authorize({ npsso });
  save(await exchangeAccessCodeForAuthTokens(code));
}

let refreshing: Promise<StoredSession> | null = null;

/** Access token válido, renovado automaticamente com o refresh token (~2 meses). */
export async function getAccessToken(): Promise<string> {
  const session = load();
  if (!session || session.refreshExpiresAt <= Date.now()) throw new SessionExpired();
  if (session.accessExpiresAt - Date.now() > 60_000) return session.accessToken;

  refreshing ??= exchangeRefreshTokenForAuthTokens(session.refreshToken)
    .then(save)
    .catch(() => {
      throw new SessionExpired();
    })
    .finally(() => (refreshing = null));
  return (await refreshing).accessToken;
}

export function signOut() {
  localStorage.removeItem(KEY);
  clearCache();
}
