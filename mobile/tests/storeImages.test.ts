import { describe, expect, it } from "vitest";
import { imageCandidates, resizedStoreImage } from "../src/lib/images";

describe("imagens da loja no tamanho da tela", () => {
  const url = "https://image.api.playstation.com/vulcan/ap/rnd/202010/2915/capa.png";

  it("pede a largura da tela (em degraus de 40 px) e mantém a original como reserva", () => {
    expect(resizedStoreImage(url, 170, 2)).toBe(`${url}?w=360`);
    expect(resizedStoreImage(url, 170, 3)).toBe(`${url}?w=440`);
    expect(imageCandidates(url, 170)).toEqual([resizedStoreImage(url, 170), url]);
  });

  it("não mexe em imagens de outros servidores nem em endereços que já têm parâmetros", () => {
    expect(resizedStoreImage("https://psnobj.prod.dl.playstation.net/x.png", 100, 2)).toBeNull();
    expect(resizedStoreImage(`${url}?w=100`, 170, 2)).toBeNull();
    expect(imageCandidates("https://psnobj.prod.dl.playstation.net/x.png", 100)).toHaveLength(1);
  });
});
