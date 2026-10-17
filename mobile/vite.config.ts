import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Caminhos relativos: o app é servido de dentro do APK.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // JavaScript compatível com WebViews mais antigos (Chrome 87+), para
    // aparelhos em que o "Android System WebView" não é atualizado.
    target: ["es2020", "chrome87"],
  },
});
