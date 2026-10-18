import { useEffect, useState } from "react";
import { t } from "../i18n";
import { ExitToast, useDoubleBackToExit } from "../lib/backButton";
import { extractNpsso } from "../lib/npsso";
import { getSettings } from "../lib/settings";
import { signInWithCode, signInWithNpsso } from "../psn/auth";
import { isNativeApp, PsnLogin } from "../psn/native";

/** O login silencioso é tentado uma vez por abertura do app (não depois de "Sair"). */
let silentTried = false;

/** Depois de "Sair", a tela de login não entra sozinha de novo com o login da Sony salvo. */
export function skipSilentLogin() {
  silentTried = true;
}

export function LoginPage({
  notice,
  onSignedIn,
}: {
  notice: string | null;
  onSignedIn: (mode: "psn" | "demo") => void;
}) {
  const native = isNativeApp();
  const [firstLogin] = useState(() => {
    const s = getSettings();
    // Quem já viu o aviso dos recursos online entrou antes desta opção existir.
    return !s.signedInBefore && !s.cloudNoticeSeen;
  });
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  async function finish(credential: { code?: string; npsso?: string }) {
    setBusy(true);
    setError(null);
    try {
      if (credential.code) await signInWithCode(credential.code);
      else if (credential.npsso) await signInWithNpsso(credential.npsso);
      else return;
      onSignedIn("psn");
    } catch (e) {
      console.error(e);
      setError(t("A PSN recusou o login. Tente de novo; se continuar, use a opção manual abaixo."));
    } finally {
      setBusy(false);
    }
  }

  async function loginWithSony() {
    setError(null);
    setBusy(true);
    try {
      await finish(await PsnLogin.login());
    } finally {
      setBusy(false);
    }
  }

  // Ao abrir o app, reaproveita o login da Sony salvo no aparelho, sem
  // mostrar a página da Sony. A página só abre ao tocar em "Entrar com a PSN".
  useEffect(() => {
    if (!native || silentTried) return;
    silentTried = true;
    setChecking(true);
    PsnLogin.silentLogin()
      .then((r) => (r.code ? finish({ code: r.code }) : undefined))
      .catch(() => {})
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const npsso = extractNpsso(manual);
    if (!npsso) setError(t("Isso não parece um código NPSSO válido. Cole o texto inteiro mostrado pela Sony."));
    else void finish({ npsso });
  }

  // No login não há tela anterior: dois toques em voltar fecham o app.
  const exitWarning = useDoubleBackToExit(
    () => false,
    () => {},
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[calc(2rem+var(--sab))] pt-[calc(2rem+var(--sat))]">
      {/* Bloco principal centralizado na vertical; o aviso de privacidade fica no rodapé. */}
      <div className="my-auto flex flex-col items-center pt-6 text-center">
        <img src="./icon.png" alt="" className="h-28 w-28 drop-shadow-[0_8px_24px_rgba(0,112,209,0.45)]" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Plathunt</h1>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ps-blue-2">Trophy Tracker</p>
        <p className="mt-2 max-w-xs text-muted">
          {t("Seus troféus da PlayStation e as conquistas dos seus amigos, no celular.")}
        </p>

        {notice && <p className="mt-6 w-full rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">{notice}</p>}

        <div className="mt-10 w-full space-y-3">
          {native ? (
            <button
              onClick={loginWithSony}
              disabled={busy || checking}
              className="w-full rounded-xl bg-ps-blue py-3.5 text-base font-semibold active:bg-ps-blue-2 disabled:opacity-60"
            >
              {checking ? t("Verificando login salvo…") : busy ? t("Conectando à PSN…") : t("Entrar com a PSN")}
            </button>
          ) : (
            <p className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
              {t("O login com a PSN funciona no app Android. Aqui no navegador você pode ver a demonstração.")}
            </p>
          )}

          <button
            onClick={() => onSignedIn("demo")}
            // Enquanto confere o login salvo, a demonstração esperaria e depois trocaria para a PSN.
            disabled={busy || checking}
            className="w-full rounded-xl border border-line py-3 text-sm text-muted active:bg-surface"
          >
            {t("Ver demonstração")}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {native && (
          <details className="mt-8 w-full text-left text-sm text-muted">
            <summary>{t("Problemas? Entrar manualmente")}</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>
                {t("Em um navegador, entre na sua conta em")}{" "}
                <a
                  className="text-ps-blue-2 underline"
                  href="https://www.playstation.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  playstation.com
                </a>
                .
              </li>
              <li>
                {t("No mesmo navegador, abra")}{" "}
                <a
                  className="text-ps-blue-2 underline"
                  href="https://ca.account.sony.com/api/v1/ssocookie"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("este link da Sony")}
                </a>{" "}
                {t("e copie todo o texto.")}
              </li>
              <li>{t("Cole aqui:")}</li>
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
      </div>

      <p className="pt-8 text-center text-xs leading-relaxed text-muted">
        {/* Como os dados circulam: só antes do primeiro login com a PSN. */}
        {firstLogin &&
          `${t(
            "🔒 Seus dados da PSN vão direto do celular para a Sony e ficam no aparelho. Curtidas e pedidos de boost usam o servidor do app, e você escolhe se quer usá-los depois de entrar.",
          )} `}
        {t("O Plathunt não é afiliado à Sony Interactive Entertainment.")}
      </p>
      <ExitToast show={exitWarning} />
    </div>
  );
}
