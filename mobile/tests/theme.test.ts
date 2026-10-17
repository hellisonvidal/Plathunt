import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_COLORS, toRgbChannels } from "../src/lib/theme";

const SRC = join(__dirname, "../src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

describe("cores do tema em WebViews antigos", () => {
  it("converte cores para canais RGB", () => {
    expect(toRgbChannels("#0b0f1a")).toBe("11 15 26");
    expect(toRgbChannels(" #fff ")).toBe("255 255 255");
    expect(toRgbChannels("rgb(1, 2, 3)")).toBe("1 2 3");
    expect(toRgbChannels("oklch(0.5 0.1 200)")).toBeNull();
  });

  it("toda classe de cor do tema com transparência tem a regra com --rgb-*", () => {
    const css = readFileSync(join(SRC, "styles.css"), "utf8");
    const pattern = new RegExp(`\\b(?:bg|text|border|ring|shadow|divide|outline)-(?:${THEME_COLORS.join("|")})/\\d+\\b`, "g");
    const used = new Set(
      files(SRC)
        .filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith("styles.css"))
        .flatMap((f) => readFileSync(f, "utf8").match(pattern) ?? []),
    );
    expect(used.size).toBeGreaterThan(0);
    const missing = [...used].filter((cls) => !css.includes(`.${cls.replace("/", "\\/")} {`));
    expect(missing).toEqual([]);
  });
});
