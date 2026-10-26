import { Capacitor, registerPlugin } from "@capacitor/core";

/** Plugin nativo (android/.../PsnLoginPlugin.java). */
interface PsnLoginPlugin {
  /**
   * Abre o formulário de login da Sony (Auth Tab do navegador, com chave de
   * acesso; ou a tela antiga, sem navegador compatível). Devolve o código OAuth quando o
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

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.plathunt.trophytracker";

/** Plugin nativo da versão da Play Store (android/app/src/play/.../PlayUpdatePlugin.java). */
interface PlayUpdatePlugin {
  /** Pergunta à Play Store se há versão mais nova publicada. */
  check(): Promise<{ available: boolean; versionCode: number; downloaded: boolean }>;
  /**
   * Abre a janela "Atualização disponível" do Google Play: flexível (baixa em
   * segundo plano) quando a loja deixa, senão a de tela cheia. false se não abriu.
   */
  update(options?: { type?: "flexible" | "immediate" }): Promise<{ started: boolean }>;
  /** Instala a versão já baixada no modo flexível (o app reinicia). */
  complete(): Promise<void>;
  /** A versão terminou de baixar no modo flexível. */
  addListener(event: "downloaded", fn: () => void): Promise<{ remove: () => Promise<void> }>;
}

export const PlayUpdate = registerPlugin<PlayUpdatePlugin>("PlayUpdate");

/** Plugin nativo (android/.../ExternalBrowserPlugin.java). */
interface ExternalBrowserPlugin {
  /** Abre o endereço no navegador, sem deixar outro app (ex.: o da PlayStation) capturar o link. */
  open(options: { url: string }): Promise<void>;
  /** Abre o endereço da loja no app PlayStation; opened=false se ele não estiver instalado. */
  openInPlayStationApp(options: { url: string }): Promise<{ opened: boolean }>;
  /** Tela de compartilhar do Android com o texto. */
  share(options: { text: string; title?: string }): Promise<void>;
  /** Manda o texto direto para o WhatsApp (sent=false se não estiver instalado). */
  shareToWhatsApp(options: { text: string }): Promise<{ sent: boolean }>;
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

/**
 * Abre um jogo da loja no app PlayStation (é onde dá para comprar e mandar
 * baixar no console). Sem o app instalado, ou fora do Android, abre no navegador.
 */
export async function openInPlayStationApp(url: string): Promise<void> {
  if (isNativeApp()) {
    try {
      if ((await ExternalBrowser.openInPlayStationApp({ url })).opened) return;
    } catch {
      // Versão antiga do app sem o método: segue para o navegador.
    }
  }
  await openInBrowser(url);
}

/**
 * Compartilha um texto pela tela do sistema (WhatsApp, Telegram, Discord...).
 * Devolve false quando não há tela de compartilhar (aí a tela oferece copiar).
 */
/**
 * Abre o WhatsApp com o texto pronto. No app vai direto para o WhatsApp (os
 * emojis chegam certos); sem o método nativo (versão antiga) ou no navegador,
 * usa o link wa.me.
 */
export async function shareToWhatsApp(text: string): Promise<void> {
  if (isNativeApp()) {
    try {
      if ((await ExternalBrowser.shareToWhatsApp({ text })).sent) return;
      // WhatsApp não instalado: a tela de compartilhar mostra os outros apps.
      if (await shareText(text)) return;
    } catch {
      // Segue para o link.
    }
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (isNativeApp()) await openInBrowser(url);
  else window.open(url, "_blank", "noopener");
}

export async function shareText(text: string, title?: string): Promise<boolean> {
  if (isNativeApp()) {
    try {
      await ExternalBrowser.share({ text, title });
      return true;
    } catch {
      // Sem o método nativo: tenta o do navegador.
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return true;
    } catch (e) {
      // Fechar a tela de compartilhar também conta como "compartilhou".
      return (e as Error)?.name === "AbortError";
    }
  }
  return false;
}
