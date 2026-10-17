import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { restorePersisted } from "./lib/persist";
import { initTheme } from "./lib/theme";
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
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
setTimeout(start, RESTORE_TIMEOUT_MS);
restorePersisted()
  .catch((e) => console.error("Restauração:", e))
  .finally(start);
