"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loginAction, type LoginState } from "../actions";

interface PsnLoginPlugin {
  login(): Promise<{ npsso?: string }>;
}

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: { PsnLogin?: PsnLoginPlugin };
    };
  }
}

/** Plugin nativo de login da PSN, presente só dentro do app Android. */
function getNativePlugin(): PsnLoginPlugin | null {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.PsnLogin ?? null;
}

function useNativePlugin() {
  const [plugin, setPlugin] = useState<PsnLoginPlugin | null>(null);
  useEffect(() => setPlugin(getNativePlugin()), []);
  return plugin;
}

/** Botão "Entrar com a PSN" do app: abre a tela da Sony e envia o NPSSO capturado. */
export function NativeLoginButton() {
  const plugin = useNativePlugin();
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [opening, setOpening] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!plugin) return null;

  async function start() {
    setOpening(true);
    try {
      const { npsso } = await plugin!.login();
      if (npsso && inputRef.current && formRef.current) {
        inputRef.current.value = npsso;
        formRef.current.requestSubmit();
      }
    } finally {
      setOpening(false);
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input ref={inputRef} type="hidden" name="npsso" />
      <button
        type="button"
        onClick={start}
        disabled={pending || opening}
        className="w-full rounded-xl bg-ps-blue py-3 text-base font-semibold hover:bg-ps-blue-2 disabled:opacity-60"
      >
        {pending ? "Importando seus troféus…" : "Entrar com a PSN"}
      </button>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

/** No app, recolhe o passo a passo manual; no navegador, mostra normalmente. */
export function ManualLoginSteps({ children }: { children: React.ReactNode }) {
  const plugin = useNativePlugin();
  if (!plugin) return <>{children}</>;
  return (
    <details className="mt-4 text-sm text-muted">
      <summary className="cursor-pointer">Problemas? Entrar manualmente</summary>
      {children}
    </details>
  );
}
