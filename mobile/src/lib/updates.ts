import { t } from "../i18n";
import { VERSION_CODE } from "./settings";

/** Repositório onde o GitHub Actions publica cada versão do APK (Releases). */
export const REPO = "hellisonvidal/Trophyhunt";
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

export type UpdateResult =
  | { status: "up-to-date"; latest: number }
  | { status: "available"; latest: number; apkUrl: string; notes: string | null; label: string }
  | { status: "unavailable"; reason: string };

/** "v1.1.1-build-3" (ou o antigo "build-42") → número do build; outros formatos → null. */
export function parseBuildTag(tag: string | undefined): number | null {
  const m = tag?.match(/^(?:v\d+(?:\.\d+)*-)?build-(\d+)$/);
  return m ? Number(m[1]) : null;
}

interface ReleaseJson {
  tag_name?: string;
  /** Ex.: "Plathunt 1.1.1 (build 4)". */
  name?: string | null;
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
    // Nome da versão para mostrar ("Plathunt 1.1.1 (build 4)"), não o código interno.
    label: release.name?.replace(/^Plathunt\s*/, "").trim() || `build ${latest}`,
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
    return evaluateRelease((await res.json()) as ReleaseJson, VERSION_CODE);
  } catch {
    return { status: "unavailable", reason: t("Sem conexão com o GitHub agora.") };
  }
}
