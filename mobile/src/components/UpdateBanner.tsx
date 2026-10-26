import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../i18n";
import { VERSION_CODE } from "../lib/settings";
import { checkForUpdate } from "../lib/updates";
import { isNativeApp, isPlayStoreBuild, openInBrowser, PLAY_STORE_URL, PlayUpdate } from "../psn/native";

/**
 * Lembrete de atualização: sempre que o app abre (ou volta para a tela) com
 * uma versão mais antiga que a publicada, mostra uma faixa no topo. Na versão
 * da Play Store quem responde é a própria loja: o app abre sozinho a janela
 * "Atualização disponível" do Google Play (no máximo uma vez por dia para cada
 * versão), o download corre em segundo plano e, ao terminar, a faixa oferece
 * reiniciar. Na versão do GitHub, a última Release. "Depois" esconde só até a
 * próxima vez que o app abrir.
 */
const PROMPT_KEY = "tm.playUpdatePrompt";
const PROMPT_EVERY = 24 * 60 * 60 * 1000;

/** Abre a janela do Google Play sozinha só uma vez por dia para cada versão. */
function shouldPrompt(versionCode: number): boolean {
  try {
    const [code, at] = (localStorage.getItem(PROMPT_KEY) ?? "").split(":").map(Number);
    if (code === versionCode && Date.now() - at < PROMPT_EVERY) return false;
    localStorage.setItem(PROMPT_KEY, `${versionCode}:${Date.now()}`);
  } catch {}
  return true;
}

export function UpdateBanner() {
  const navigate = useNavigate();
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    let alive = true;
    const check = async () => {
      try {
        if (isPlayStoreBuild()) {
          if (!Capacitor.isPluginAvailable("PlayUpdate")) return;
          const info = await PlayUpdate.check();
          if (!alive) return;
          setAvailable(info.available);
          setDownloaded(info.downloaded);
          if (info.available && !info.downloaded && shouldPrompt(info.versionCode)) {
            await PlayUpdate.update({ type: "flexible" });
          }
        } else {
          const result = await checkForUpdate();
          if (alive) setAvailable(result.status === "available" && result.latest > Number(VERSION_CODE));
        }
      } catch {
        // Sem internet ou sem a loja: tenta de novo quando o app voltar.
      }
    };
    void check();
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void check();
    });
    const done =
      isPlayStoreBuild() && Capacitor.isPluginAvailable("PlayUpdate")
        ? PlayUpdate.addListener("downloaded", () => alive && setDownloaded(true))
        : null;
    return () => {
      alive = false;
      void sub.then((s) => s.remove());
      void done?.then((s) => s.remove());
    };
  }, []);

  if (downloaded) {
    return (
      <div role="status" className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-ps-blue-2/40 bg-ps-blue-2/10 p-3">
        <span className="text-2xl" aria-hidden>
          ✅
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("Atualização baixada")}</p>
          <p className="text-xs text-muted">{t("Reinicie o Plathunt para usar a nova versão.")}</p>
        </div>
        <button
          onClick={() => void PlayUpdate.complete().catch(() => {})}
          className="shrink-0 rounded-full bg-ps-blue px-3 py-1 text-xs font-semibold"
        >
          {t("Reiniciar")}
        </button>
      </div>
    );
  }
  if (!available || dismissed) return null;
  const play = isPlayStoreBuild();
  return (
    <div role="status" className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-ps-blue-2/40 bg-ps-blue-2/10 p-3">
      <span className="text-2xl" aria-hidden>
        ⬆️
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t("Nova versão do Plathunt disponível")}</p>
        <p className="text-xs text-muted">
          {play ? t("Atualize pela Play Store para ter as novidades e correções.") : t("Atualize para ter as novidades e correções.")}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          onClick={async () => {
            if (!play) return navigate("/settings");
            try {
              if ((await PlayUpdate.update()).started) return;
            } catch {
              // Segue para a página da loja.
            }
            await openInBrowser(PLAY_STORE_URL);
          }}
          className="rounded-full bg-ps-blue px-3 py-1 text-xs font-semibold"
        >
          {t("Atualizar")}
        </button>
        <button onClick={() => setDismissed(true)} className="text-[0.6875rem] text-muted underline">
          {t("Depois")}
        </button>
      </div>
    </div>
  );
}
