import { useState } from "react";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { Avatar, ProgressBar } from "../components/ui";
import { clearCache } from "../lib/cache";
import { clearReactions } from "../lib/reactions";
import { APP_VERSION, updateSettings, useSettings, type Settings } from "../lib/settings";
import { PS_PLUS_TIERS, type PsPlusTier } from "../lib/psplus";
import { THEMES } from "../lib/theme";
import { checkForUpdate, RELEASES_PAGE, type UpdateResult } from "../lib/updates";
import { useData } from "../lib/useData";
import { AppUpdater, isNativeApp } from "../psn/native";

const LANGUAGES: { value: Settings["language"]; label: string }[] = [
  { value: "pt-BR", label: "Português" },
  { value: "en-US", label: "English" },
  { value: "es-ES", label: "Español" },
];
const PS_PLUS_OPTIONS = (Object.keys(PS_PLUS_TIERS) as PsPlusTier[]).map((value) => ({
  value,
  label: PS_PLUS_TIERS[value],
}));
const FEED_DAYS: Settings["feedDays"][] = [7, 30, 90];
const START_TABS: { value: Settings["startTab"]; label: string }[] = [
  { value: "/", label: "Perfil" },
  { value: "/stats", label: "Estatísticas" },
  { value: "/friends", label: "Amigos" },
  { value: "/activity", label: "Atividades" },
  { value: "/ranking", label: "Ranking" },
];

export function SettingsPage() {
  const { client, mode, signOut } = useApp();
  const settings = useSettings();
  const { data: me } = useData((force) => client.me(force), [client]);
  const [toast, setToast] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateResult | null>(null);
  const [checking, setChecking] = useState(false);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  async function check() {
    setChecking(true);
    setUpdate(await checkForUpdate());
    setChecking(false);
  }

  return (
    <>
      <PageHeader title="Configurações" back />
      <div className="space-y-6 px-4 pb-8 pt-4">
        <Section title="Conta">
          <div className="flex items-center gap-3 p-4">
            <Avatar src={me?.avatarUrl ?? null} name={me?.onlineId ?? "?"} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{me?.onlineId ?? "…"}</p>
              <p className="text-xs text-muted">{mode === "demo" ? "Modo demonstração" : "Conectado à PSN"}</p>
            </div>
          </div>
          <Row
            label="Sair / trocar de conta"
            hint="Na próxima entrada a PSN pede usuário e senha, então dá para usar outra conta"
            danger
            onClick={() => signOut()}
          />
        </Section>

        <Section title="Aparência">
          <div className="space-y-2 p-4">
            <p className="text-sm">Tema</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tema">
              {THEMES.map((t) => (
                <ThemeCard
                  key={t.value}
                  theme={t}
                  selected={settings.theme === t.value}
                  onSelect={() => updateSettings({ theme: t.value })}
                />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Atualizações">
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm">Versão instalada</p>
              <p className="text-xs text-muted">{APP_VERSION}</p>
            </div>
            <button
              onClick={check}
              disabled={checking}
              className="rounded-full bg-ps-blue px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {checking ? "Verificando…" : "Verificar atualizações"}
            </button>
          </div>
          {update && <UpdateStatus result={update} />}
        </Section>

        <Section title="PlayStation Plus">
          <Choice
            label="Plano"
            options={[{ value: "" as const, label: "Não informar" }, ...PS_PLUS_OPTIONS]}
            value={settings.psPlusTier}
            onChange={(psPlusTier) => updateSettings({ psPlusTier })}
          />
          <label className="flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1">
              <span className="block text-sm">Vencimento da assinatura</span>
              <span className="mt-0.5 block text-xs text-muted">
                A PSN não informa plano nem vencimento; o perfil mostra o que você preencher aqui.
              </span>
            </span>
            <input
              type="date"
              value={settings.psPlusExpires}
              onChange={(e) => updateSettings({ psPlusExpires: e.target.value })}
              className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm"
            />
          </label>
        </Section>

        <Section title="Atividades">
          <Choice
            label="Período das atividades"
            options={FEED_DAYS.map((d) => ({ value: d, label: `${d} dias` }))}
            value={settings.feedDays}
            onChange={(feedDays) => updateSettings({ feedDays })}
          />
        </Section>

        <Section title="Troféus e jogos">
          <Choice
            label="Idioma dos nomes de jogos e troféus"
            options={LANGUAGES}
            value={settings.language}
            onChange={(language) => {
              updateSettings({ language });
              // Os nomes em cache estão no idioma antigo.
              clearCache();
              flash("Idioma alterado. Os dados serão recarregados.");
            }}
          />
          <Toggle
            label="Revelar troféus secretos"
            hint="Mostra nome e descrição de troféus ocultos ainda bloqueados (pode conter spoilers)"
            checked={settings.revealSecrets}
            onChange={(revealSecrets) => updateSettings({ revealSecrets })}
          />
        </Section>

        <Section title="Geral">
          <Choice
            label="Abrir o app em"
            options={START_TABS}
            value={settings.startTab}
            onChange={(startTab) => updateSettings({ startTab })}
          />
        </Section>

        <Section title="Dados">
          <Row
            label="Atualizar todos os dados agora"
            hint="Busca tudo de novo na PSN em vez de usar o que está salvo"
            onClick={() => {
              clearCache();
              flash("Pronto! Os dados serão buscados de novo na PSN.");
            }}
          />
          <Row
            label="Apagar minhas curtidas"
            onClick={() => {
              clearReactions();
              flash("Curtidas apagadas.");
            }}
          />
        </Section>

        <Section title="Sobre">
          <p className="p-4 text-xs leading-relaxed text-muted">
            PlayStation Trophy Mania {APP_VERSION}. Sem servidor: os dados vão direto do celular para a PSN e ficam só
            no aparelho. Não é afiliado à Sony Interactive Entertainment; PlayStation é marca da Sony.
          </p>
        </Section>
      </div>

      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-md rounded-xl bg-surface-2 px-4 py-3 text-center text-sm shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}

/** Cartão de tema com uma miniatura das cores (fundo, cartão e destaque). */
function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: (typeof THEMES)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const [bg, card, accent] = theme.swatch;
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`rounded-xl border-2 p-2 text-left ${selected ? "border-ps-blue-2" : "border-line"}`}
    >
      <span className="flex h-14 flex-col justify-end gap-1 rounded-lg p-1.5" style={{ background: bg }}>
        <span className="block h-2 w-3/4 rounded-sm" style={{ background: card }} />
        <span className="flex items-center gap-1">
          <span className="block h-2 flex-1 rounded-sm" style={{ background: card }} />
          <span className="block h-3 w-6 rounded-sm" style={{ background: accent }} />
        </span>
      </span>
      <span className="mt-1.5 flex items-center justify-between gap-1">
        <span className="text-sm font-semibold">{theme.label}</span>
        {selected && <span className="text-ps-blue-2">✓</span>}
      </span>
      <span className="block text-[11px] leading-tight text-muted">{theme.description}</span>
    </button>
  );
}

type InstallState =
  | { step: "idle" }
  | { step: "downloading"; percent: number; downloaded: number }
  | { step: "installing" }
  | { step: "permission" }
  | { step: "error"; message: string };

/**
 * Baixa e instala a atualização dentro do app (plugin nativo AppUpdater), com
 * barra de progresso. No navegador (ou se o download falhar), abre o link.
 */
function InstallButton({ url }: { url: string }) {
  const [state, setState] = useState<InstallState>({ step: "idle" });

  if (!isNativeApp()) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl bg-ps-blue py-2.5 text-center text-sm font-semibold"
      >
        Baixar e instalar
      </a>
    );
  }

  async function start() {
    setState({ step: "downloading", percent: 0, downloaded: 0 });
    const sub = await AppUpdater.addListener("progress", (p) =>
      setState({ step: "downloading", percent: p.percent, downloaded: p.downloaded }),
    );
    try {
      const { status } = await AppUpdater.downloadAndInstall({ url });
      setState(status === "permission-needed" ? { step: "permission" } : { step: "installing" });
    } catch (e) {
      setState({ step: "error", message: e instanceof Error ? e.message : "Falha no download." });
    } finally {
      await sub.remove();
    }
  }

  if (state.step === "downloading") {
    const mb = (state.downloaded / 1_048_576).toFixed(1);
    return (
      <div className="space-y-1.5" role="status">
        <ProgressBar value={state.percent < 0 ? 100 : state.percent} />
        <p className="text-xs text-muted">
          Baixando… {state.percent >= 0 ? `${state.percent}% · ` : ""}
          {mb} MB
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state.step === "installing" && (
        <p className="text-xs text-ps-blue-2">Download concluído. Confirme a instalação na tela do Android.</p>
      )}
      {state.step === "permission" && (
        <p className="text-xs text-gold">
          Permita que o PlayStation Trophy Mania instale apps (na tela que abriu), volte e toque em “Baixar e instalar”
          de novo.
        </p>
      )}
      {state.step === "error" && (
        <p className="text-xs text-red-400">
          {state.message}{" "}
          <a href={url} target="_blank" rel="noreferrer" className="underline">
            Baixar pelo navegador
          </a>
        </p>
      )}
      <button onClick={start} className="block w-full rounded-xl bg-ps-blue py-2.5 text-center text-sm font-semibold">
        {state.step === "idle" ? "Baixar e instalar" : "Baixar e instalar de novo"}
      </button>
    </div>
  );
}

function UpdateStatus({ result }: { result: UpdateResult }) {
  if (result.status === "up-to-date") {
    return <p className="border-t border-line px-4 py-3 text-sm text-ps-blue-2">✓ Você está na versão mais recente.</p>;
  }
  if (result.status === "available") {
    return (
      <div className="space-y-2 border-t border-line px-4 py-3">
        <p className="text-sm font-semibold">Nova versão disponível: 1.0.{result.latest}</p>
        {result.notes && <p className="whitespace-pre-line text-xs text-muted">{result.notes}</p>}
        <InstallButton url={result.apkUrl} />
      </div>
    );
  }
  return (
    <div className="space-y-2 border-t border-line px-4 py-3">
      <p className="text-xs text-muted">{result.reason}</p>
      <a
        href={RELEASES_PAGE}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl border border-line py-2.5 text-center text-sm"
      >
        Abrir versões no GitHub
      </a>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  danger,
  onClick,
}: {
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-2">
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${danger ? "text-red-400" : ""}`}>{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <span className="text-muted">›</span>
    </button>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 p-4">
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-surface-2 transition peer-checked:bg-ps-blue after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-ink after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2 p-4">
      <p className="text-sm">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              value === o.value ? "bg-ps-blue font-semibold" : "border border-line text-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
