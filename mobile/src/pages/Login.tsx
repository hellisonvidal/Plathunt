import { useState } from "react";
import { extractNpsso } from "../lib/npsso";
import { signInWithNpsso } from "../psn/auth";
import { isNativeApp, PsnLogin } from "../psn/native";

export function LoginPage({
  notice,
  onSignedIn,
}: {
  notice: string | null;
  onSignedIn: (mode: "psn" | "demo") => void;
}) {
  const native = isNativeApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  async function finish(npsso: string) {
    setBusy(true);
    setError(null);
    try {
      await signInWithNpsso(npsso);
      onSignedIn("psn");
    } catch (e) {
      console.error(e);
      setError("A PSN recusou o login. Tente de novo; se continuar, use a opção manual abaixo.");
    } finally {
      setBusy(false);
    }
  }

  async function loginWithSony() {
    setError(null);
    const { npsso } = await PsnLogin.login();
    if (npsso) await finish(npsso);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const npsso = extractNpsso(manual);
    if (!npsso) setError("Isso não parece um código NPSSO válido. Cole o texto inteiro mostrado pela Sony.");
    else void finish(npsso);
  }

  return (
    <div className="safe-top mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-16">
      <img src="./icon.png" alt="" className="h-20 w-20 rounded-2xl" />
      <h1 className="mt-5 text-3xl font-bold tracking-tight">Trophy Mania</h1>
      <p className="mt-2 text-muted">Seus troféus da PlayStation e as conquistas dos seus amigos, no celular.</p>

      {notice && <p className="mt-6 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">{notice}</p>}

      <div className="mt-10 space-y-3">
        {native ? (
          <button
            onClick={loginWithSony}
            disabled={busy}
            className="w-full rounded-xl bg-ps-blue py-3.5 text-base font-semibold active:bg-ps-blue-2 disabled:opacity-60"
          >
            {busy ? "Conectando à PSN…" : "Entrar com a PSN"}
          </button>
        ) : (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
            O login com a PSN funciona no app Android. Aqui no navegador você pode ver a demonstração.
          </p>
        )}

        <button
          onClick={() => onSignedIn("demo")}
          disabled={busy}
          className="w-full rounded-xl border border-line py-3 text-sm text-muted active:bg-surface"
        >
          Ver demonstração
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {native && (
        <details className="mt-8 text-sm text-muted">
          <summary>Problemas? Entrar manualmente</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>
              Em um navegador, entre na sua conta em{" "}
              <a className="text-ps-blue-2 underline" href="https://www.playstation.com/" target="_blank" rel="noreferrer">
                playstation.com
              </a>
              .
            </li>
            <li>
              No mesmo navegador, abra{" "}
              <a
                className="text-ps-blue-2 underline"
                href="https://ca.account.sony.com/api/v1/ssocookie"
                target="_blank"
                rel="noreferrer"
              >
                este link da Sony
              </a>{" "}
              e copie todo o texto.
            </li>
            <li>Cole aqui:</li>
          </ol>
          <form onSubmit={submitManual} className="mt-2 flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder='{"npsso":"…"}'
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink outline-none"
            />
            <button disabled={busy} className="rounded-xl bg-ps-blue px-4 font-semibold text-ink disabled:opacity-60">
              OK
            </button>
          </form>
        </details>
      )}

      <p className="mt-auto pt-10 text-xs leading-relaxed text-muted">
        🔒 Sem servidor: seus dados vão direto do celular para a PSN e ficam só no aparelho. O Trophy Mania não é
        afiliado à Sony Interactive Entertainment.
      </p>
    </div>
  );
}
