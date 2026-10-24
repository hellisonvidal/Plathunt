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
  // A versão no tamanho da tela primeiro; se o servidor recusar, a original.
  return sized ? [sized, ...list] : list;
}

/**
 * As imagens da loja (image.api.playstation.com) vêm em alta resolução (até
 * 1920 px, centenas de KB cada). O servidor da Sony entrega em outro tamanho
 * com "?w=": pedimos só o necessário para a largura na tela, em degraus de
 * 40 px (telas parecidas reaproveitam a mesma imagem do cache).
 */
export function resizedStoreImage(
  url: string,
  fitPx: number,
  pixelRatio = typeof window === "undefined" ? 2 : window.devicePixelRatio || 1,
): string | null {
  if (!/^https:\/\/image\.api\.playstation\.com\//i.test(url) || url.includes("?")) return null;
  const width = Math.max(80, Math.ceil((fitPx * Math.min(pixelRatio, 2.5)) / 40) * 40);
  return `${url}?w=${width}`;
}
