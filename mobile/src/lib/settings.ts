import { useEffect, useState } from "react";
import { persistSet } from "./persist";

/** Preferências do app, salvas no celular. */
export interface Settings {
  /** Idioma dos nomes de jogos e troféus vindos da PSN. */
  language: "pt-BR" | "en-US" | "es-ES";
  /** Período das Atividades, em dias. */
  feedDays: 7 | 30 | 90;
  /** Traduzir nomes e descrições de troféus que a Sony não traduziu. */
  autoTranslate: boolean;
  /** Mostrar nome e descrição de troféus secretos ainda bloqueados. */
  revealSecrets: boolean;
  /** Tema de cores (Configurações → Aparência). */
  theme: "playstation" | "light" | "oled" | "green" | "crimson" | "purple" | "spiderman" | "horizon";
  /** Aba em que o app abre. */
  startTab: "/" | "/stats" | "/friends" | "/activity" | "/ranking";
}

export const DEFAULT_SETTINGS: Settings = {
  language: "pt-BR",
  feedDays: 30,
  revealSecrets: false,
  autoTranslate: true,
  startTab: "/",
  theme: "playstation",
};

const KEY = "tm.settings" as const;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    // Só as chaves conhecidas: opções removidas (ex.: plano do PS Plus) somem do que fica salvo.
    const known = Object.keys(DEFAULT_SETTINGS).filter((k) => k in saved);
    // O tema "Grafite" virou "Verde △".
    if (saved.theme === "graphite") saved.theme = "green";
    return { ...DEFAULT_SETTINGS, ...Object.fromEntries(known.map((k) => [k, saved[k]])) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  persistSet(KEY, JSON.stringify(next));
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
export const APP_VERSION = BUILD_NUMBER === "dev" ? "1.0 (desenvolvimento)" : `1.0.${BUILD_NUMBER}`;
