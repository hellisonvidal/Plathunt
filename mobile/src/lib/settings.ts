import { useEffect, useState } from "react";
import { deviceLanguage, LANGUAGES, setLanguage, t, type Language } from "../i18n";
import { persistSet } from "./persist";
import { deviceStoreRegion, STORE_REGIONS, type StoreRegion } from "./store";

/** Preferências do app, salvas no celular. */
export interface Settings {
  /** Idioma do app e dos nomes de jogos e troféus vindos da PSN. */
  language: Language;
  /** Período das Atividades, em dias. */
  feedDays: 7 | 30 | 90;
  /** Traduzir nomes e descrições de troféus que a Sony não traduziu. */
  autoTranslate: boolean;
  /** Mostrar nome e descrição de troféus secretos ainda bloqueados. */
  revealSecrets: boolean;
  /** Tema de cores (Configurações → Aparência). */
  theme: "auto" | "claro" | "escuro" | "playstation" | "light" | "oled" | "green" | "crimson" | "purple" | "spiderman" | "uncharted" | "deathstranding" | "horizon";
  /** Aba em que o app abre. */
  startTab: "/" | "/stats" | "/friends" | "/activity" | "/store";
  /** País da PlayStation Store (moeda e preços da aba Loja). */
  storeRegion: StoreRegion;
  /** Notificações do app (chave geral) e cada tipo. */
  notifications: boolean;
  notifyMerits: boolean;
  notifyChallenges: boolean;
  notifyBoost: boolean;
  notifyFriends: boolean;
  notifyUpdates: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  // Na primeira abertura, o idioma do aparelho.
  language: deviceLanguage(),
  feedDays: 30,
  revealSecrets: false,
  autoTranslate: true,
  startTab: "/",
  // Na primeira abertura, o país do aparelho.
  storeRegion: deviceStoreRegion(),
  // Claro ou escuro, como o sistema do aparelho.
  theme: "auto",
  notifications: true,
  notifyMerits: true,
  notifyChallenges: true,
  notifyBoost: true,
  notifyFriends: true,
  notifyUpdates: true,
};

const KEY = "tm.settings" as const;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    // Só as chaves conhecidas, com o tipo certo: opções removidas (ex.: plano do
    // PS Plus) e valores corrompidos somem do que fica salvo.
    const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
    const known = Object.keys(DEFAULT_SETTINGS).filter((k) => k in saved && typeof saved[k] === typeof defaults[k]);
    // O tema "Grafite" virou "Verde △".
    if (saved.theme === "graphite") saved.theme = "green";
    // A aba Ranking virou parte de Estatísticas.
    if (saved.startTab === "/ranking") saved.startTab = "/stats";
    const merged = { ...DEFAULT_SETTINGS, ...Object.fromEntries(known.map((k) => [k, saved[k]])) } as Settings;
    if (!LANGUAGES.some((l) => l.value === merged.language)) merged.language = DEFAULT_SETTINGS.language;
    if (!STORE_REGIONS.some((r) => r.value === merged.storeRegion)) merged.storeRegion = DEFAULT_SETTINGS.storeRegion;
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  persistSet(KEY, JSON.stringify(next));
  setLanguage(next.language);
  listeners.forEach((l) => l());
  return next;
}

/** Avisa quando alguma configuração muda. */
export function onSettingsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useSettings(): Settings {
  const [settings, setSettings] = useState(getSettings);
  useEffect(() => {
    const sync = () => setSettings(getSettings());
    listeners.add(sync);
    return () => void listeners.delete(sync);
  }, []);
  return settings;
}

/** Número do build (definido pelo GitHub Actions); "dev" em builds locais. */
export const BUILD_NUMBER: string = import.meta.env.VITE_BUILD_NUMBER ?? "dev";
/** Versão do app; o número do build vai junto para identificar o APK. */
export const VERSION = "1.1.0";
const DEV_VERSION = "1.1.0 (desenvolvimento)";
export const APP_VERSION = BUILD_NUMBER === "dev" ? DEV_VERSION : `${VERSION} (build ${BUILD_NUMBER})`;

/** APP_VERSION no idioma atual (para mostrar na tela). */
export function appVersion(): string {
  return BUILD_NUMBER === "dev" ? t(DEV_VERSION) : APP_VERSION;
}

/** Aplica o idioma salvo (chamado ao abrir o app e quando a cópia nativa é restaurada). */
export function initLanguage() {
  setLanguage(getSettings().language);
}
