import type { Presence } from "../psn/types";
import { t } from "../i18n";

/** Bolinha no avatar: verde online, cinza offline, contorno quando o status é oculto. */
export function StatusDot({ status }: { status: Presence["status"] }) {
  const label = status === "online" ? t("Online") : status === "offline" ? t("Offline") : t("Status oculto");
  const color = status === "online" ? "bg-online" : status === "offline" ? "bg-muted" : "bg-surface";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-surface ${color} ${
        status === "unknown" ? "outline outline-1 outline-muted" : ""
      }`}
    />
  );
}
