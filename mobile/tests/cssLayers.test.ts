import { describe, expect, it } from "vitest";
import { flattenCascadeLayers } from "../cssLayers";

describe("CSS para WebViews antigos", () => {
  it("desfaz @layer mantendo a ordem e o conteúdo", () => {
    const css = '@layer theme,base;@layer theme{:root{--a:1}}@layer base{a{content:"}{"}}@layer x{@layer y{b{c:d}}}.u{e:f}';
    expect(flattenCascadeLayers(css)).toBe(':root{--a:1}a{content:"}{"}b{c:d}.u{e:f}');
  });
});
