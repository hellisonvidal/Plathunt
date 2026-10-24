/**
 * Endereços de imagem da PSN. Avatares costumam vir como
 * http://psn-rsc.prod.dl.playstation.net/..., e o app roda em
 * https://localhost: o Android bloqueia imagens http ali ("mixed content").
 * Por isso tentamos primeiro a versão https e só depois o endereço original.
 */
export function imageCandidates(url: string | null | undefined): string[] {
  if (!url) return [];
  const trimmed = url.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("//")) return [`https:${trimmed}`];
  if (/^http:\/\//i.test(trimmed)) return [trimmed.replace(/^http:\/\//i, "https://"), trimmed];
  return [trimmed];
}
