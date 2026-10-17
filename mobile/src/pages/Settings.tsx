import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { Avatar, ProgressBar } from "../components/ui";
import { clearCache } from "../lib/cache";
import { clearReactions } from "../lib/reactions";
import { APP_VERSION, updateSettings, useSettings, type Settings } from "../lib/settings";
import { STORE_REGIONS } from "../lib/store";
import { LANGUAGES } from "../i18n";
import { THEMES } from "../lib/theme";
import { checkForUpdate, RELEASES_PAGE, type UpdateResult } from "../lib/updates";
import { useData } from "../lib/useData";
import { AppUpdater, isNativeApp } from "../psn/native";

const FEED_DAYS: Settings["feedDays"][] = [7, 30, 90];
const START_TABS: { value: Settings["startTab"]; label: string }[] = [
  { value: "/", label: "Perfil" },
  { value: "/stats", label: "Estatísticas" },
  { value: "/friends", label: "Amigos" },
  { value: "/activity", label: "Atividades" },
  { value: "/store", label: "Loja" },
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
          <ThemesButton current={settings.theme} />
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
            label="Idioma do app, dos jogos e dos troféus"
            options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
            value={settings.language}
            onChange={(language) => {
              updateSettings({ language });
              // Os nomes em cache estão no idioma antigo.
              clearCache();
              flash("Idioma alterado. Os dados serão recarregados.");
            }}
          />
          <Toggle
            label="Traduzir troféus automaticamente"
            hint="Traduz para o idioma acima os nomes e descrições que a Sony não traduziu (tradutor do Google)"
            checked={settings.autoTranslate}
            onChange={(autoTranslate) => updateSettings({ autoTranslate })}
          />
          <Toggle
            label="Revelar troféus secretos"
            hint="Mostra nome e descrição de troféus ocultos ainda bloqueados (pode conter spoilers)"
            checked={settings.revealSecrets}
            onChange={(revealSecrets) => updateSettings({ revealSecrets })}
          />
        </Section>

        <Section title="Loja">
          <Choice
            label="País da PlayStation Store (moeda e preços)"
            options={STORE_REGIONS.map((r) => ({ value: r.value, label: r.label }))}
            value={settings.storeRegion}
            onChange={(storeRegion) => updateSettings({ storeRegion })}
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
/** Botão das Configurações que abre a tela de temas, mostrando o tema atual. */
function ThemesButton({ current }: { current: Settings["theme"] }) {
  const navigate = useNavigate();
  const theme = THEMES.find((t) => t.value === current) ?? THEMES[0];
  return (
    <button
      onClick={() => navigate("/settings/themes")}
      className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-2"
    >
      <ThemeSwatch theme={theme} className="h-10 w-14 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm">Temas</span>
        <span className="mt-0.5 block text-xs text-muted">
          {theme.label} · {THEMES.length} temas de jogos de PlayStation
        </span>
      </span>
      <span className="text-muted">›</span>
    </button>
  );
}

/** Tela de temas (Configurações → Temas). A escolha vale na hora. */
export function ThemesPage() {
  const settings = useSettings();
  return (
    <>
      <PageHeader title="Temas" back />
      <div className="px-4 pb-8 pt-4">
        <p className="mb-3 text-sm text-muted">
          Cada tema usa as cores do personagem principal de um jogo de PlayStation.
        </p>
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
    </>
  );
}

/** Miniatura das cores de um tema: fundo, cartões e destaque. */
function ThemeSwatch({ theme, className = "" }: { theme: (typeof THEMES)[number]; className?: string }) {
  const [bg, card, accent] = theme.swatch;
  return (
    <span className={`flex flex-col justify-end gap-1 rounded-lg p-1.5 ${className}`} style={{ background: bg }}>
      <span className="block h-2 w-3/4 rounded-sm" style={{ background: card }} />
      <span className="flex items-center gap-1">
        <span className="block h-2 flex-1 rounded-sm" style={{ background: card }} />
        <span className="block h-3 w-6 rounded-sm" style={{ background: accent }} />
      </span>
    </span>
  );
}

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: (typeof THEMES)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`rounded-xl border-2 p-2 text-left ${selected ? "border-ps-blue-2" : "border-line"}`}
    >
      <ThemeSwatch theme={theme} className="h-14" />
      <span className="mt-1.5 flex items-center justify-between gap-1">
        <span className="text-sm font-semibold">{theme.label}</span>
        {selected && <span className="text-ps-blue-2">✓</span>}
      </span>
      <span className="block text-[0.6875rem] leading-tight text-muted">{theme.description}</span>
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
      <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">{title}</h2>
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
