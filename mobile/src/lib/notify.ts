import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getSettings, type Settings } from "./settings";

/**
 * Notificações do celular (Configurações → Notificações). Cada tipo pode ser
 * desligado, e há uma chave geral. No app usa as notificações do Android; no
 * navegador (demonstração), as do navegador, se permitidas.
 */
export type NotifyKind = "merits" | "challenges" | "boost" | "friends" | "updates";

const SETTING: Record<NotifyKind, keyof Settings> = {
  merits: "notifyMerits",
  challenges: "notifyChallenges",
  boost: "notifyBoost",
  friends: "notifyFriends",
  updates: "notifyUpdates",
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

/**
 * Mostra (ou agenda, com `at`) uma notificação, se o tipo estiver ligado.
 * `key` identifica a notificação: a mesma chave substitui a anterior.
 */
export async function notify(kind: NotifyKind, key: string, title: string, body: string, at?: Date): Promise<void> {
  if (!notificationsEnabled(kind)) return;
  if (at && at.getTime() <= Date.now()) return;
  try {
    if (native()) {
      if (!(await requestNotificationPermission())) return;
      await LocalNotifications.schedule({
        notifications: [{ id: notificationId(key), title, body, ...(at ? { schedule: { at, allowWhileIdle: true } } : {}) }],
      });
      return;
    }
    if (at || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(title, { body, tag: key });
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
