import type { CapacitorConfig } from "@capacitor/cli";

// O app Android é autocontido: a interface (mobile/) vai dentro do APK e fala
// direto com a PSN. Não há servidor.
const config: CapacitorConfig = {
  appId: "com.hellisonvidal.perseus",
  appName: "PlayStation Trophy Mania",
  webDir: "mobile/dist",
  backgroundColor: "#0b0d12",
  android: {
    // Alguns avatares da PSN só existem em http://. O app tenta https antes
    // (mobile/src/lib/images.ts); isto permite o endereço original como reserva.
    allowMixedContent: true,
  },
  plugins: {
    // Faz o fetch() passar pela pilha HTTP nativa: a API da PSN não aceita
    // chamadas de navegador (CORS), mas aceita as do app.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
