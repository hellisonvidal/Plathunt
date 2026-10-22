import { describe, expect, it } from "vitest";
import { storeRegionForCountry } from "../src/lib/store";

describe("storeRegionForCountry (país da conta da PSN → loja)", () => {
  it("usa a loja do próprio país da conta", () => {
    expect(storeRegionForCountry("br")).toBe("pt-BR");
    expect(storeRegionForCountry("US")).toBe("en-US");
    expect(storeRegionForCountry("ca")).toBe("en-CA");
    expect(storeRegionForCountry("CL")).toBe("es-CL");
  });
  it("países sem loja própria no app usam a mais parecida", () => {
    expect(storeRegionForCountry("at")).toBe("de-DE");
    expect(storeRegionForCountry("nz")).toBe("en-AU");
    expect(storeRegionForCountry("uy")).toBe("es-AR");
  });
  it("sem país conhecido não muda nada", () => {
    expect(storeRegionForCountry(null)).toBeNull();
    expect(storeRegionForCountry("zz")).toBeNull();
  });
});
