import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getSettings, type Settings } from "./settings";

/**
 * Notificações do celular (Configurações → Notificações). Cada tipo pode ser
 * desligado, e há uma chave geral. No app usa as notificações do Android; no
 * navegador (demonstração), as do navegador, se permitidas.
 */
export type NotifyKind = "merits" | "challenges" | "boost" | "friends" | "updates" | "social";

const SETTING: Record<NotifyKind, keyof Settings> = {
  merits: "notifyMerits",
  challenges: "notifyChallenges",
  boost: "notifyBoost",
  friends: "notifyFriends",
  updates: "notifyUpdates",
  social: "notifySocial",
};

/** Tela que cada tipo de notificação abre ao ser tocada (pode ser trocada em `notify`). */
export const NOTIFY_ROUTES: Record<NotifyKind, string> = {
  merits: "/activity?view=merits",
  challenges: "/activity?view=challenges",
  boost: "/activity?view=boost",
  friends: "/activity",
  updates: "/settings",
  social: "/activity",
};

export function notificationsEnabled(kind: NotifyKind, settings = getSettings()): boolean {
  return settings.notifications && settings[SETTING[kind]] === true;
}

const native = () => Capacitor.isNativePlatform();

/** Pede a permissão de notificações (Android 13+ pergunta ao usuário). */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (native()) {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === "granted") return true;
      return (await LocalNotifications.requestPermissions()).display === "granted";
    }
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Id numérico estável a partir de um texto (o Android pede ids inteiros). */
export function notificationId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

/** Aviso mostrado dentro do app (o app está aberto na tela). */
export interface InAppNotice {
  kind: NotifyKind;
  key: string;
  title: string;
  body: string;
  route: string;
}

const inAppListeners = new Set<(n: InAppNotice) => void>();

/** A tela do app que mostra os avisos se inscreve aqui; enquanto houver inscrito, os avisos imediatos vão para ela. */
export function onInAppNotice(listener: (n: InAppNotice) => void): () => void {
  inAppListeners.add(listener);
  return () => void inAppListeners.delete(listener);
}

/**
 * Mostra (ou agenda, com `at`) uma notificação, se o tipo estiver ligado.
 * Com o app aberto, os avisos imediatos aparecem dentro do app.
 * `key` identifica a notificação: a mesma chave substitui a anterior.
 */
export async function notify(
  kind: NotifyKind,
  key: string,
  title: string,
  body: string,
  at?: Date,
  /** Tela aberta ao tocar (padrão: a do tipo, em NOTIFY_ROUTES). */
  route: string = NOTIFY_ROUTES[kind],
): Promise<void> {
  if (!notificationsEnabled(kind)) return;
  if (at && at.getTime() <= Date.now()) return;
  // Com o app aberto na tela, o aviso aparece dentro do app (e leva à tela dele ao tocar).
  if (!at && inAppListeners.size > 0 && typeof document !== "undefined" && document.visibilityState === "visible") {
    for (const listener of inAppListeners) listener({ kind, key, title, body, route });
    return;
  }
  try {
    if (native()) {
      if (!(await requestNotificationPermission())) return;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId(key),
            title,
            body,
            smallIcon: "ic_stat_trophy",
            iconColor: "#7fc4ec",
            extra: { route },
            ...(at ? { schedule: { at, allowWhileIdle: true } } : {}),
          },
        ],
      });
      return;
    }
    if (at || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, { body, tag: key });
    n.onclick = () => {
      window.focus();
      location.hash = `#${route}`;
    };
  } catch {
    // Notificação é um extra: se o aparelho recusar, o app segue normalmente.
  }
}

/** Cancela uma notificação agendada. */
export async function cancelNotification(key: string): Promise<void> {
  try {
    if (native()) await LocalNotifications.cancel({ notifications: [{ id: notificationId(key) }] });
  } catch {}
}

/** Desliga tudo: cancela as notificações agendadas (lembretes de boost e prazos de desafio). */
export async function cancelAllNotifications(): Promise<void> {
  try {
    if (!native()) return;
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  } catch {}
}

/**
 * Ao tocar numa notificação do Android, abre a tela dela. O Android guarda o
 * toque até o app registrar o ouvinte, então funciona também com o app fechado.
 */
export function onNotificationTap(open: (route: string) => void): () => void {
  if (!native()) return () => {};
  let remove: (() => void) | undefined;
  void LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
    const route = (notification.extra as { route?: unknown } | undefined)?.route;
    if (typeof route === "string" && route.startsWith("/")) open(route);
  })
    .then((h) => (remove = () => void h.remove()))
    .catch(() => {});
  return () => remove?.();
}
