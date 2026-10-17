import { useEffect, useState } from "react";

/**
 * Idiomas do app. Os textos são escritos em português no código e passam por
 * `t()`, que devolve a tradução do idioma escolhido (Configurações → Idioma)
 * ou o próprio texto em português. Cada grupo de telas tem o seu arquivo de
 * traduções em `locales/`.
 */
export const LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "it-IT", label: "Italiano" },
  { value: "ja-JP", label: "日本語" },
] as const;
export type Language = (typeof LANGUAGES)[number]["value"];
export type Dictionary = Record<string, string>;
/** Traduções de um grupo de telas: texto em português → texto traduzido, por idioma. */
export type Translations = Partial<Record<Exclude<Language, "pt-BR">, Dictionary>>;

const modules = import.meta.glob<{ default: Translations }>("./locales/*.ts", { eager: true });
const DICTS: Partial<Record<Language, Dictionary>> = {};
for (const mod of Object.values(modules)) {
  for (const [lang, dict] of Object.entries(mod.default ?? {})) {
    DICTS[lang as Language] = { ...DICTS[lang as Language], ...dict };
  }
}

/** Idioma do aparelho, quando o app tem tradução para ele (senão, inglês). */
export function deviceLanguage(): Language {
  const tags = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const tag of tags.filter(Boolean)) {
    const lower = tag.toLowerCase();
    const exact = LANGUAGES.find((l) => l.value.toLowerCase() === lower);
    if (exact) return exact.value;
    const base = LANGUAGES.find((l) => l.value.slice(0, 2) === lower.slice(0, 2));
    if (base) return base.value;
  }
  return "en-US";
}

let current: Language = "pt-BR";
const listeners = new Set<() => void>();

export function setLanguage(lang: Language) {
  if (lang === current) return;
  current = lang;
  listeners.forEach((l) => l());
}

export function getLanguage(): Language {
  return current;
}

/** Locale para datas e números (Intl). */
export function locale(): string {
  return current;
}

/**
 * Texto no idioma atual. `vars` preenche "{nome}" no texto; números saem
 * formatados no padrão do idioma (1.000 / 1,000).
 */
export function t(text: string, vars?: Record<string, string | number>): string {
  const out = (current === "pt-BR" ? undefined : DICTS[current]?.[text]) ?? text;
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    if (v === undefined) return m;
    return typeof v === "number" ? v.toLocaleString(current) : v;
  });
}

/** Re-renderiza quando o idioma muda. */
export function useLanguage(): Language {
  const [lang, setLang] = useState(current);
  useEffect(() => {
    const sync = () => setLang(current);
    listeners.add(sync);
    return () => void listeners.delete(sync);
  }, []);
  return lang;
}

/** Para os testes: todas as chaves de um idioma. */
export function dictionary(lang: Language): Dictionary {
  return DICTS[lang] ?? {};
}
