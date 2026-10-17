import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { restorePersisted } from "./lib/persist";
import { initLanguage } from "./lib/settings";
import { initTheme } from "./lib/theme";
import { useLanguage } from "./i18n";
import "./styles.css";

// Recupera login e preferências da cópia nativa antes de abrir o app, para
// que uma atualização nunca peça um novo login. Se o armazenamento nativo não
// responder (alguns aparelhos demoram na primeira abertura), o app abre assim
// mesmo depois de 2 s, em vez de ficar parado na tela inicial.
const RESTORE_TIMEOUT_MS = 2000;
let started = false;
function start() {
  if (started) return;
  started = true;
  try {
    initTheme();
  } catch (e) {
    console.error("Tema:", e);
  }
  initLanguage();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <LanguageRoot />
      </ErrorBoundary>
    </StrictMode>,
  );
}
/** Ao trocar o idioma, a interface inteira é redesenhada com os novos textos. */
function LanguageRoot() {
  const lang = useLanguage();
  return <App key={lang} />;
}

setTimeout(start, RESTORE_TIMEOUT_MS);
restorePersisted()
  .catch((e) => console.error("Restauração:", e))
  .finally(start);
