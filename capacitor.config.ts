import type { CapacitorConfig } from "@capacitor/cli";

// Endereço do servidor publicado (ex.: https://perseus.onrender.com).
// Definido na hora do build: CAP_SERVER_URL=https://... npx cap sync android
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.hellisonvidal.perseus",
  appName: "Perseus",
  webDir: "mobile/www",
  backgroundColor: "#0b0f1a",
  server: serverUrl
    ? {
        url: serverUrl,
        // Mantém a navegação dentro do app só para o próprio servidor.
        allowNavigation: [new URL(serverUrl).host],
      }
    : undefined,
  android: {
    allowMixedContent: false,
  },
};

export default config;
