import { t } from "../i18n";
import { BUILD_NUMBER } from "./settings";

/** Repositório onde o GitHub Actions publica cada versão do APK (Releases). */
export const REPO = "hellisonvidal/Trophy-Mania";
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

export type UpdateResult =
  | { status: "up-to-date"; latest: number }
  | { status: "available"; latest: number; apkUrl: string; notes: string | null }
  | { status: "unavailable"; reason: string };

/** "build-42" → 42; outros formatos → null. */
export function parseBuildTag(tag: string | undefined): number | null {
  const m = tag?.match(/^build-(\d+)$/);
  return m ? Number(m[1]) : null;
}

interface ReleaseJson {
  tag_name?: string;
  body?: string | null;
  html_url?: string;
  assets?: { name: string; browser_download_url: string }[];
}

/** Decide, a partir da release mais recente, se há versão nova. */
export function evaluateRelease(release: ReleaseJson, current: string): UpdateResult {
  const latest = parseBuildTag(release.tag_name);
  if (latest === null) return { status: "unavailable", reason: t("Versão publicada em formato desconhecido.") };
  const installed = Number(current);
  if (Number.isFinite(installed) && installed >= latest) return { status: "up-to-date", latest };
  const apk = release.assets?.find((a) => a.name.endsWith(".apk"));
  return {
    status: "available",
    latest,
    apkUrl: apk?.browser_download_url ?? release.html_url ?? RELEASES_PAGE,
    notes: release.body?.trim() || null,
  };
}

/**
 * Consulta a última release no GitHub. Com o repositório privado, a API
 * responde 404 para quem não está logado; aí o app abre a página no navegador.
 */
export async function checkForUpdate(): Promise<UpdateResult> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (res.status === 404) {
      return {
        status: "unavailable",
        reason: t("O repositório é privado (ou ainda não há versão publicada). Veja as versões no GitHub."),
      };
    }
    if (!res.ok) return { status: "unavailable", reason: t("O GitHub respondeu {status}.", { status: String(res.status) }) };
    return evaluateRelease((await res.json()) as ReleaseJson, BUILD_NUMBER);
  } catch {
    return { status: "unavailable", reason: t("Sem conexão com o GitHub agora.") };
  }
}
