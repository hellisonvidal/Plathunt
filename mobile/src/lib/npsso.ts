/**
 * Aceita tanto o token NPSSO puro quanto o JSON inteiro copiado de
 * https://ca.account.sony.com/api/v1/ssocookie — ex.: {"npsso":"abc..."}.
 * Retorna null se não parecer um NPSSO válido.
 */
export function extractNpsso(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  let candidate = text;
  const fromJson = text.match(/"npsso"\s*:\s*"([^"]+)"/);
  if (fromJson) candidate = fromJson[1];

  candidate = candidate.replace(/^["']|["']$/g, "").trim();
  return /^[A-Za-z0-9]{64}$/.test(candidate) ? candidate : null;
}
