import type { CapacitorConfig } from "@capacitor/cli";

// O app Android é autocontido: a interface (mobile/) vai dentro do APK e fala
// direto com a PSN. Não há servidor.
const config: CapacitorConfig = {
  appId: "com.hellisonvidal.perseus",
  appName: "PlayStation Trophy Mania",
  webDir: "mobile/dist",
  backgroundColor: "#0b0f1a",
  plugins: {
    // Faz o fetch() passar pela pilha HTTP nativa: a API da PSN não aceita
    // chamadas de navegador (CORS), mas aceita as do app.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
