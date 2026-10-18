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

/**
 * Versão da Play Store: o app não tem o plugin de atualização (o Google não
 * deixa o app se atualizar sozinho), e as versões novas chegam pela loja.
 */
export const isPlayStoreBuild = () => isNativeApp() && !Capacitor.isPluginAvailable("AppUpdater");

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.hellisonvidal.perseus";

/** Plugin nativo (android/.../ExternalBrowserPlugin.java). */
interface ExternalBrowserPlugin {
  /** Abre o endereço no navegador, sem deixar outro app (ex.: o da PlayStation) capturar o link. */
  open(options: { url: string }): Promise<void>;
}

const ExternalBrowser = registerPlugin<ExternalBrowserPlugin>("ExternalBrowser");

/**
 * Abre um link no navegador. No app Android usa o plugin nativo (o app da
 * PlayStation capturava os links da loja e abria na tela inicial dele); se o
 * plugin falhar, ou fora do app, abre do jeito normal.
 */
export async function openInBrowser(url: string): Promise<void> {
  if (isNativeApp()) {
    try {
      await ExternalBrowser.open({ url });
      return;
    } catch {
      // Segue para o jeito normal.
    }
  }
  window.open(url, "_blank", "noopener");
}
