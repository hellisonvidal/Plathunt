import { Component, type ReactNode } from "react";

/** Apaga dados que podem ser refeitos (cache da PSN, preços), sem tirar o login. */
export function clearRecoverableData() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("tm.cache.") || k === "tm.prices") localStorage.removeItem(k);
    }
  } catch {}
}

/**
 * Rede de proteção do app inteiro: se uma tela quebrar (dado corrompido,
 * aparelho com WebView diferente), mostra uma tela de recuperação em vez de
 * deixar o app em branco. Usa estilos próprios, sem depender do tema.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Erro na interface:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const button: React.CSSProperties = {
      display: "block",
      width: "100%",
      padding: "12px",
      marginTop: "12px",
      borderRadius: "12px",
      border: "1px solid #2f3a52",
      background: "#131a2b",
      color: "#e8ecf5",
      fontSize: "15px",
    };
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          padding: "48px 24px",
          background: "#0b0f1a",
          color: "#e8ecf5",
          fontFamily: "system-ui, sans-serif",
          boxSizing: "border-box",
        }}
      >
        <p style={{ fontSize: "40px", margin: 0 }}>🛠️</p>
        <h1 style={{ fontSize: "20px", margin: "12px 0 8px" }}>Algo deu errado nesta tela</h1>
        <p style={{ color: "#8b95ad", fontSize: "14px", lineHeight: 1.5 }}>
          O app encontrou um erro, mas seu login e suas configurações estão salvos. Tente de novo; se continuar,
          limpe os dados temporários.
        </p>
        <button style={{ ...button, background: "#0070d1", border: "none" }} onClick={() => location.reload()}>
          Tentar de novo
        </button>
        <button
          style={button}
          onClick={() => {
            clearRecoverableData();
            location.hash = "#/";
            location.reload();
          }}
        >
          Limpar dados temporários e voltar ao início
        </button>
        <details style={{ marginTop: "24px", color: "#8b95ad", fontSize: "12px" }}>
          <summary>Detalhes do erro</summary>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {String(error?.stack || error?.message || error)}
          </pre>
        </details>
      </div>
    );
  }
}
