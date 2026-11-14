import { describe, expect, it } from "vitest";
import { isLocked } from "../src/lib/pro";

describe("Plathunt Pro", () => {
  it("só bloqueia na Play Store, com o produto à venda e sem a compra", () => {
    expect(isLocked({ available: true, owned: false }, true)).toBe(true);
    expect(isLocked({ available: true, owned: true }, true)).toBe(false);
    // Produto ainda não criado/ativo na Play Console: tudo liberado.
    expect(isLocked({ available: false, owned: false }, true)).toBe(false);
    // APK do GitHub, navegador e demonstração: tudo liberado.
    expect(isLocked({ available: true, owned: false }, false)).toBe(false);
  });
});
