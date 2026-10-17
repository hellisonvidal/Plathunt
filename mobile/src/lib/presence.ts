import type { Presence } from "../psn/types";
import { t } from "../i18n";

/** Presença como a PSN devolve (em `basicPresence` ou na lista `basicPresences`). */
export interface RawPresence {
  accountId?: string;
  availability?: string;
  onlineStatus?: string;
  platform?: string;
  lastOnlineDate?: string;
  lastAvailableDate?: string;
  primaryPlatformInfo?: { onlineStatus?: string; platform?: string; lastOnlineDate?: string } | null;
  gameTitleInfoList?: { titleName?: string; conceptIconUrl?: string; npTitleIconUrl?: string }[] | null;
}

export const UNKNOWN_PRESENCE: Presence = { status: "unknown", platform: null, lastOnline: null, game: null };

/** Converte a presença da PSN; quem esconde o status aparece como "unknown". */
export function toPresence(raw: RawPresence | null | undefined): Presence {
  if (!raw || typeof raw !== "object") return UNKNOWN_PRESENCE;
  const info = raw.primaryPlatformInfo ?? null;
  const status = (info?.onlineStatus ?? raw.onlineStatus)?.toLowerCase();
  const platform = info?.platform ?? raw.platform ?? null;
  const game = raw.gameTitleInfoList?.[0];
  return {
    status: status === "online" ? "online" : status === "offline" ? "offline" : "unknown",
    platform: platform ? platform.toUpperCase() : null,
    lastOnline: info?.lastOnlineDate ?? raw.lastOnlineDate ?? raw.lastAvailableDate ?? null,
    game:
      status === "online" && game?.titleName
        ? { name: game.titleName, iconUrl: game.conceptIconUrl ?? game.npTitleIconUrl ?? null }
        : null,
  };
}

/** Ordem de exibição: online primeiro, depois offline, depois quem esconde o status. */
export const presenceRank = (p: Presence | undefined) =>
  p?.status === "online" ? 0 : p?.status === "offline" ? 1 : 2;

/** "Online · jogando X no PS5", "Offline · visto há 3 h", "Status oculto". */
export function presenceText(p: Presence | undefined, now = Date.now()): string {
  if (!p || p.status === "unknown") return t("Status oculto");
  if (p.status === "online") {
    const platform = p.platform;
    if (p.game) {
      const game = p.game.name;
      return platform
        ? t("Online · jogando {game} no {platform}", { game, platform })
        : t("Online · jogando {game}", { game });
    }
    return platform ? t("Online no {platform}", { platform }) : t("Online");
  }
  if (!p.lastOnline) return t("Offline");
  const mins = Math.max(0, Math.round((now - new Date(p.lastOnline).getTime()) / 60_000));
  if (!Number.isFinite(mins)) return t("Offline");
  if (mins < 60) return t("Offline · visto há {n} min", { n: Math.max(1, mins) });
  if (mins < 48 * 60) return t("Offline · visto há {n} h", { n: Math.round(mins / 60) });
  return t("Offline · visto há {n} dias", { n: Math.round(mins / 1440) });
}
