import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { restorePersisted } from "./lib/persist";
import "./styles.css";

// Recupera login e preferências da cópia nativa antes de abrir o app, para
// que uma atualização nunca peça um novo login.
restorePersisted().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
