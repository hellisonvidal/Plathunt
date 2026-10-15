import { describe, expect, it } from "vitest";
import { imageCandidates } from "../src/lib/images";

describe("imageCandidates", () => {
  it("tenta https antes do http original (avatares da PSN)", () => {
    expect(imageCandidates("http://psn-rsc.prod.dl.playstation.net/psn-rsc/avatar/a_l.png")).toEqual([
      "https://psn-rsc.prod.dl.playstation.net/psn-rsc/avatar/a_l.png",
      "http://psn-rsc.prod.dl.playstation.net/psn-rsc/avatar/a_l.png",
    ]);
  });
  it("mantém endereços https e completa os sem protocolo", () => {
    expect(imageCandidates("https://image.api.playstation.com/x.png")).toEqual(["https://image.api.playstation.com/x.png"]);
    expect(imageCandidates("//image.api.playstation.com/x.png")).toEqual(["https://image.api.playstation.com/x.png"]);
  });
  it("sem endereço, nenhuma tentativa", () => {
    expect(imageCandidates(null)).toEqual([]);
    expect(imageCandidates("  ")).toEqual([]);
  });
});
