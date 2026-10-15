import { Capacitor, registerPlugin } from "@capacitor/core";

/** Plugin nativo (android/.../PsnLoginPlugin.java). */
interface PsnLoginPlugin {
  /**
   * Abre direto o formulário de login da Sony. Devolve o código OAuth quando o
   * usuário entra (ou o NPSSO, como reserva); {} se ele fechar a tela.
   */
  login(): Promise<{ code?: string; npsso?: string }>;
  /**
   * Sem abrir tela: usa o login da Sony já salvo no aparelho para pegar um
   * código OAuth. {} se não houver login salvo (ou ele expirou).
   */
  silentLogin(): Promise<{ code?: string }>;
  /** Troca o NPSSO pelo código OAuth (lê o redirect, o que o WebView não consegue). */
  authorize(options: { npsso: string }): Promise<{ code: string }>;
  /** Apaga o login da Sony do aparelho (o próximo login pede usuário e senha). */
  clearSession(): Promise<void>;
}

export const PsnLogin = registerPlugin<PsnLoginPlugin>("PsnLogin");

export interface DownloadProgress {
  /** 0–100, ou -1 se o servidor não informou o tamanho. */
  percent: number;
  downloaded: number;
  total: number;
}

/** Plugin nativo (android/.../AppUpdaterPlugin.java). */
interface AppUpdaterPlugin {
  /** Baixa o APK dentro do app e abre o instalador do Android. */
  downloadAndInstall(options: { url: string }): Promise<{ status: "installing" | "permission-needed" }>;
  addListener(event: "progress", listener: (p: DownloadProgress) => void): Promise<{ remove: () => Promise<void> }>;
}

export const AppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");

export const isNativeApp = () => Capacitor.isNativePlatform();
