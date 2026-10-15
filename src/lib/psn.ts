import "server-only";
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromAccountId,
  getUserTrophyProfileSummary,
  type AuthorizationPayload,
  type AuthTokensResponse,
} from "psn-api";
import type { User } from "@prisma/client";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";

export class PsnReauthRequired extends Error {
  constructor() {
    super("Sua sessão da PSN expirou. Entre novamente.");
  }
}

function tokenFields(tokens: AuthTokensResponse) {
  const now = Date.now();
  return {
    accessTokenEnc: encrypt(tokens.accessToken),
    accessExpiresAt: new Date(now + tokens.expiresIn * 1000),
    refreshTokenEnc: encrypt(tokens.refreshToken),
    refreshExpiresAt: new Date(now + tokens.refreshTokenExpiresIn * 1000),
  };
}

function pickAvatar(avatars: { size: string; url: string }[]): string | null {
  const order = ["xl", "l", "m", "s"];
  for (const size of order) {
    const hit = avatars.find((a) => a.size === size);
    if (hit) return hit.url;
  }
  return avatars[0]?.url ?? null;
}

/**
 * Login "direto com a PSN": troca o NPSSO por tokens OAuth, lê o perfil e
 * cria/atualiza o usuário. O NPSSO é descartado logo após a troca.
 */
export async function signInWithNpsso(npsso: string): Promise<User> {
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  const auth: AuthorizationPayload = { accessToken: tokens.accessToken };

  const summary = await getUserTrophyProfileSummary(auth, "me");
  const profile = await getProfileFromAccountId(auth, summary.accountId);

  const data = {
    onlineId: profile.onlineId,
    avatarUrl: pickAvatar(profile.avatars),
    aboutMe: profile.aboutMe || null,
    isPlus: profile.isPlus,
    trophyLevel: Number(summary.trophyLevel) || 1,
    trophyTier: summary.tier,
    bronze: summary.earnedTrophies.bronze,
    silver: summary.earnedTrophies.silver,
    gold: summary.earnedTrophies.gold,
    platinum: summary.earnedTrophies.platinum,
    ...tokenFields(tokens),
  };

  return db.user.upsert({
    where: { psnAccountId: summary.accountId },
    create: { psnAccountId: summary.accountId, ...data },
    update: data,
  });
}

/** Retorna um access token válido, renovando com o refresh token se preciso. */
export async function getPsnAuth(user: User): Promise<AuthorizationPayload> {
  if (user.accessExpiresAt.getTime() - Date.now() > 60_000) {
    return { accessToken: decrypt(user.accessTokenEnc) };
  }
  if (user.refreshExpiresAt.getTime() <= Date.now()) throw new PsnReauthRequired();

  let tokens: AuthTokensResponse;
  try {
    tokens = await exchangeRefreshTokenForAuthTokens(decrypt(user.refreshTokenEnc));
  } catch {
    throw new PsnReauthRequired();
  }
  await db.user.update({ where: { id: user.id }, data: tokenFields(tokens) });
  return { accessToken: tokens.accessToken };
}
