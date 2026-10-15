import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import { ManualLoginSteps, NativeLoginButton } from "./NativeLogin";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { expired } = await searchParams;

  return (
    <div className="mx-auto max-w-md pt-10">
      <h1 className="text-3xl font-bold tracking-tight">
        <span className="text-ps-blue-2">◆</span> Perseus
      </h1>
      <p className="mt-2 text-muted">
        Seus troféus da PlayStation, com os amigos. Comemore cada platina, reaja com emojis e mande os parabéns.
      </p>

      {expired && (
        <p className="mt-6 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
          Sua sessão da PSN expirou. Entre novamente para continuar.
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 font-semibold">Conecte sua conta PlayStation</h2>
        <NativeLoginButton />
        <ManualLoginSteps>
          <ol className="mt-4 space-y-4 text-sm">
            <li className="flex gap-3">
              <Step n={1} />
              <div>
                Faça login na sua conta PSN em{" "}
                <a href="https://www.playstation.com/" target="_blank" rel="noreferrer" className="text-ps-blue-2 underline">
                  playstation.com
                </a>
                .
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={2} />
              <div>
                No mesmo navegador, abra{" "}
                <a
                  href="https://ca.account.sony.com/api/v1/ssocookie"
                  target="_blank"
                  rel="noreferrer"
                  className="text-ps-blue-2 underline"
                >
                  este link da Sony
                </a>{" "}
                e copie todo o texto que aparecer.
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={3} />
              <div className="min-w-0 flex-1">
                Cole aqui:
                <LoginForm />
              </div>
            </li>
          </ol>
        </ManualLoginSteps>
      </section>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        🔒 O código (NPSSO) é usado uma única vez para obter os tokens de acesso da PSN e é descartado em seguida.
        Os tokens ficam criptografados no servidor e você pode sair a qualquer momento. O Perseus não é afiliado à
        Sony Interactive Entertainment.
      </p>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ps-blue text-xs font-bold">
      {n}
    </span>
  );
}
