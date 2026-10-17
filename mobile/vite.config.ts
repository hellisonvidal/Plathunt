import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { flattenCascadeLayers } from "./cssLayers";

/**
 * O Tailwind 4 põe os estilos dentro de @layer, que o Chrome só entende a
 * partir da versão 99. Em celulares com o "Android System WebView" mais
 * antigo, tudo o que está em @layer é ignorado e o app aparece com as cores
 * erradas. Aqui as camadas são desfeitas no CSS final, mantendo a ordem.
 */
function legacyCss(): Plugin {
  return {
    name: "trophy-mania:flatten-css-layers",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "asset" && file.fileName.endsWith(".css")) {
          file.source = flattenCascadeLayers(String(file.source));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), legacyCss()],
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
