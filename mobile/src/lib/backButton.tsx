import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";

/** Tempo para o segundo toque em "voltar" fechar o app. */
export const EXIT_WINDOW_MS = 2000;

/**
 * Decide o que fazer com o botão voltar do Android: voltar uma tela, mostrar
 * o aviso ou fechar o app (segundo toque dentro de EXIT_WINDOW_MS).
 */
export function decideBack(canGoBack: boolean, lastPressAt: number, now: number): "back" | "warn" | "exit" {
  if (canGoBack) return "back";
  return now - lastPressAt <= EXIT_WINDOW_MS ? "exit" : "warn";
}

/**
 * Liga o botão voltar do Android. `canGoBack()` diz se há uma tela para onde
 * voltar (ex.: dentro de um jogo); nas abas principais e no login, é preciso
 * tocar duas vezes para fechar o app.
 */
export function useDoubleBackToExit(canGoBack: () => boolean, goBack: () => void) {
  const [warning, setWarning] = useState(false);
  const lastPress = useRef(0);
  const latest = useRef({ canGoBack, goBack });
  latest.current = { canGoBack, goBack };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = CapApp.addListener("backButton", () => {
      const now = Date.now();
      const action = decideBack(latest.current.canGoBack(), lastPress.current, now);
      if (action === "back") return latest.current.goBack();
      if (action === "exit") return void CapApp.exitApp();
      lastPress.current = now;
      setWarning(true);
      clearTimeout(timer);
      timer = setTimeout(() => setWarning(false), EXIT_WINDOW_MS);
    });
    return () => {
      clearTimeout(timer);
      void sub.then((s) => s.remove());
    };
  }, []);

  return warning;
}

export function ExitToast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-surface-2 px-4 py-2 text-sm shadow-xl"
    >
      Toque em voltar de novo para sair
    </div>
  );
}
