import { savingData } from "./dataSaver";

/**
 * Endereços de imagem da PSN. Avatares costumam vir como
 * http://psn-rsc.prod.dl.playstation.net/..., e o app roda em
 * https://localhost: o Android bloqueia imagens http ali ("mixed content").
 * Por isso tentamos primeiro a versão https e só depois o endereço original.
 */
export function imageCandidates(url: string | null | undefined, fitPx?: number): string[] {
  if (!url) return [];
  const trimmed = url.trim();
  if (!trimmed) return [];
  let list: string[];
  if (trimmed.startsWith("//")) list = [`https:${trimmed}`];
  else if (/^http:\/\//i.test(trimmed)) list = [trimmed.replace(/^http:\/\//i, "https://"), trimmed];
  else list = [trimmed];
  const sized = fitPx ? resizedStoreImage(list[0], fitPx) : null;
  // A versão menor primeiro; se o servidor recusar, a original.
  return sized ? [sized, ...list] : list;
}

/**
 * As imagens da loja e das capas de jogos (image.api.playstation.com) vêm em
 * alta resolução (até 1920 px, centenas de KB cada). O próprio servidor da
 * Sony entrega em outro tamanho com "?w=": pedimos só o necessário para o
 * tamanho na tela (economizando dados, com menos densidade).
 */
export function resizedStoreImage(url: string, fitPx: number, pixelRatio = typeof window === "undefined" ? 2 : window.devicePixelRatio || 1): string | null {
  if (!/^https:\/\/image\.api\.playstation\.com\//i.test(url) || url.includes("?")) return null;
  const density = Math.min(pixelRatio, savingData() ? 1.5 : 2.5);
  // Em degraus de 40 px: telas parecidas reaproveitam a mesma imagem do cache.
  const width = Math.max(80, Math.ceil((fitPx * density) / 40) * 40);
  return `${url}?w=${width}`;
}
