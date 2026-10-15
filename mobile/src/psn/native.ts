import { Capacitor, registerPlugin } from "@capacitor/core";

/** Plugin nativo (android/.../PsnLoginPlugin.java). */
interface PsnLoginPlugin {
  /** Abre a tela de login da Sony; devolve o NPSSO quando o usuário entra. */
  login(): Promise<{ npsso?: string }>;
  /** Troca o NPSSO pelo código OAuth (lê o redirect, o que o WebView não consegue). */
  authorize(options: { npsso: string }): Promise<{ code: string }>;
}

export const PsnLogin = registerPlugin<PsnLoginPlugin>("PsnLogin");

export const isNativeApp = () => Capacitor.isNativePlatform();
