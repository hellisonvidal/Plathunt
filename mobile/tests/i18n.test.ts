import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dictionary, LANGUAGES, setLanguage, t } from "../src/i18n";

const SRC = join(__dirname, "../src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

/** Textos literais passados para t("...") no código. */
const keys = new Set(
  files(SRC)
    .filter((f) => /\.tsx?$/.test(f) && !f.includes("i18n"))
    .flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string),
    ),
);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const others = LANGUAGES.map((l) => l.value).filter((l) => l !== "pt-BR");

describe("idiomas", () => {
  it("o app usa textos traduzíveis", () => {
    expect(keys.size).toBeGreaterThan(300);
  });

  it.each(others)("todo texto do app tem tradução em %s", (lang) => {
    const dict = dictionary(lang);
    expect([...keys].filter((k) => !(k in dict))).toEqual([]);
  });

  it.each(others)("as traduções em %s têm os mesmos {campos} do português", (lang) => {
    const dict = dictionary(lang);
    const wrong = Object.entries(dict).filter(([k, v]) => placeholders(k) !== placeholders(v) || !v.trim());
    expect(wrong).toEqual([]);
  });

  it("troca de idioma e formata números", () => {
    setLanguage("en-US");
    expect(t("{n} jogos", { n: 1234 })).toMatch(/1,234/);
    setLanguage("pt-BR");
    expect(t("{n} jogos", { n: 1234 })).toBe("1.234 jogos");
  });
});
