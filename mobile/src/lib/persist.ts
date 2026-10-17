import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

/**
 * Dados que não podem se perder numa atualização do app (login, modo,
 * configurações, curtidas). Ficam no localStorage, para leitura síncrona, e
 * numa cópia no armazenamento nativo do Android (SharedPreferences), que
 * sobrevive mesmo se o WebView limpar os dados dele.
 */
export const PERSISTED_KEYS = ["tm.session", "tm.mode", "tm.settings", "tm.reactions", "tm.prices", "tm.boosts", "tm.challenges", "tm.merits", "tm.boostInbox"] as const;
type Key = (typeof PERSISTED_KEYS)[number];

const native = () => Capacitor.isNativePlatform();

export function persistSet(key: Key, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  if (native()) void Preferences.set({ key, value }).catch(() => {});
}

export function persistRemove(key: Key) {
  try {
    localStorage.removeItem(key);
  } catch {}
  if (native()) void Preferences.remove({ key }).catch(() => {});
}

/**
 * Roda antes de abrir o app: se o localStorage perdeu algo (WebView limpo),
 * recupera da cópia nativa; se só o localStorage tem (versões antigas do app,
 * antes desta cópia existir), grava a cópia nativa.
 */
export async function restorePersisted(): Promise<void> {
  if (!native()) return;
  await Promise.all(
    PERSISTED_KEYS.map(async (key) => {
      try {
        const local = localStorage.getItem(key);
        const { value: saved } = await Preferences.get({ key });
        if (local === null && saved !== null) localStorage.setItem(key, saved);
        else if (local !== null && saved !== local) await Preferences.set({ key, value: local });
      } catch {}
    }),
  );
}
