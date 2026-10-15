import { Capacitor, registerPlugin } from "@capacitor/core";

/** Plugin nativo (android/.../PsnLoginPlugin.java). */
interface PsnLoginPlugin {
  /**
   * Abre direto o formulário de login da Sony. Devolve o código OAuth quando o
   * usuário entra (ou o NPSSO, como reserva); {} se ele fechar a tela.
   */
  login(): Promise<{ code?: string; npsso?: string }>;
  /** Troca o NPSSO pelo código OAuth (lê o redirect, o que o WebView não consegue). */
  authorize(options: { npsso: string }): Promise<{ code: string }>;
  /** Apaga o login da Sony do aparelho (o próximo login pede usuário e senha). */
  clearSession(): Promise<void>;
}

export const PsnLogin = registerPlugin<PsnLoginPlugin>("PsnLogin");

export const isNativeApp = () => Capacitor.isNativePlatform();
