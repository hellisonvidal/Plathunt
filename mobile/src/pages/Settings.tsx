import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { Avatar, ProgressBar } from "../components/ui";
import { clearCache } from "../lib/cache";
import { clearReactions } from "../lib/reactions";
import { connectCloud, disconnectCloud, useCloud } from "../lib/cloud";
import { cancelAllNotifications, requestNotificationPermission } from "../lib/notify";
import { appVersion, updateSettings, useSettings, type Settings } from "../lib/settings";
import { STORE_REGIONS } from "../lib/store";
import { LANGUAGES, locale, t } from "../i18n";
import { applyTheme, THEMES } from "../lib/theme";
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
      <PageHeader title={t("Configurações")} back />
      <div className="space-y-6 px-4 pb-8 pt-4">
        <Section title={t("Conta")}>
          <div className="flex items-center gap-3 p-4">
            <Avatar src={me?.avatarUrl ?? null} name={me?.onlineId ?? "?"} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{me?.onlineId ?? "…"}</p>
              <p className="text-xs text-muted">{mode === "demo" ? t("Modo demonstração") : t("Conectado à PSN")}</p>
            </div>
          </div>
          <Row
            label={t("Sair / trocar de conta")}
            hint={t("Na próxima entrada a PSN pede usuário e senha, então dá para usar outra conta")}
            danger
            onClick={() => signOut()}
          />
        </Section>

        <Section title={t("Aparência")}>
          <ThemesButton current={settings.theme} />
        </Section>

        <Section title={t("Atividades")}>
          <Choice
            label={t("Período das atividades")}
            options={FEED_DAYS.map((d) => ({ value: d, label: t("{d} dias", { d }) }))}
            value={settings.feedDays}
            onChange={(feedDays) => updateSettings({ feedDays })}
          />
        </Section>

        <Section title={t("Troféus e jogos")}>
          <Choice
            label={t("Idioma do app, dos jogos e dos troféus")}
            options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
            value={settings.language}
            onChange={(language) => {
              updateSettings({ language });
              // Os nomes em cache estão no idioma antigo.
              clearCache();
              flash(t("Idioma alterado. Os dados serão recarregados."));
            }}
          />
          <Toggle
            label={t("Traduzir troféus automaticamente")}
            hint={t("Traduz para o idioma acima os nomes e descrições que a Sony não traduziu (tradutor do Google)")}
            checked={settings.autoTranslate}
            onChange={(autoTranslate) => updateSettings({ autoTranslate })}
          />
          <Toggle
            label={t("Revelar troféus secretos")}
            hint={t("Mostra nome e descrição de troféus ocultos ainda bloqueados (pode conter spoilers)")}
            checked={settings.revealSecrets}
            onChange={(revealSecrets) => updateSettings({ revealSecrets })}
          />
        </Section>

        <Section title={t("Loja")}>
          <Choice
            label={t("País da PlayStation Store (moeda e preços)")}
            options={STORE_REGIONS.map((r) => ({ value: r.value, label: t(r.label) }))}
            value={settings.storeRegion}
            onChange={(storeRegion) => updateSettings({ storeRegion })}
          />
        </Section>

        <Section title={t("Geral")}>
          <Choice
            label={t("Abrir o app em")}
            options={START_TABS.map((o) => ({ ...o, label: t(o.label) }))}
            value={settings.startTab}
            onChange={(startTab) => updateSettings({ startTab })}
          />
        </Section>

        <Section title={t("Recursos online")}>
          <CloudSettings demo={mode === "demo"} onMessage={flash} />
        </Section>

        <Section title={t("Notificações")}>
          <Toggle
            label={t("🔔 Notificações")}
            hint={t("Desligue para não receber nenhuma notificação do app")}
            checked={settings.notifications}
            onChange={(notifications) => {
              updateSettings({ notifications });
              if (notifications) void requestNotificationPermission();
              else void cancelAllNotifications();
            }}
          />
          {settings.notifications &&
            (
              [
                ["notifyMerits", "Novos méritos", "Quando você libera um mérito"],
                ["notifyChallenges", "Desafios", "Quando alguém vence um desafio e um dia antes do fim do prazo"],
                ["notifyBoost", "Lembretes de boost", "No horário combinado do pedido (hoje à noite, amanhã, fim de semana)"],
                ["notifyFriends", "Platinas dos amigos", "Quando um amigo conquista uma platina"],
                ["notifyUpdates", "Novas versões do app", "Quando há uma atualização para instalar"],
                ["notifySocial", "Curtidas e pedidos recebidos", "Recursos online: quando curtem sua conquista ou mandam um pedido de boost"],
              ] as const
            ).map(([key, label, hint]) => (
              <Toggle
                key={key}
                label={t(label)}
                hint={t(hint)}
                checked={settings[key]}
                onChange={(on) => updateSettings({ [key]: on })}
              />
            ))}
        </Section>

        <Section title={t("Dados")}>
          <Row
            label={t("Atualizar todos os dados agora")}
            hint={t("Busca tudo de novo na PSN em vez de usar o que está salvo")}
            onClick={() => {
              clearCache();
              flash(t("Pronto! Os dados serão buscados de novo na PSN."));
            }}
          />
          <Row
            label={t("Apagar minhas curtidas")}
            onClick={() => {
              clearReactions();
              flash(t("Curtidas apagadas."));
            }}
          />
        </Section>

        <Section title={t("Sobre")}>
          <p className="p-4 text-xs leading-relaxed text-muted">
            {t(
              "PlayStation Trophy Mania {version}. Sem servidor: os dados vão direto do celular para a PSN e ficam só no aparelho. Não é afiliado à Sony Interactive Entertainment; PlayStation é marca da Sony.",
              { version: appVersion() },
            )}
          </p>
        </Section>

        <Section title={t("Atualizações")}>
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm">{t("Versão instalada")}</p>
              <p className="text-xs text-muted">{appVersion()}</p>
            </div>
            <button
              onClick={check}
              disabled={checking}
              className="rounded-full bg-ps-blue px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {checking ? t("Verificando…") : t("Verificar atualizações")}
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
  const theme = THEMES.find((th) => th.value === current) ?? THEMES[0];
  return (
    <button
      onClick={() => navigate("/settings/themes")}
      className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-2"
    >
      <ThemeSwatch theme={theme} className="h-10 w-14 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{t("Temas")}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {t(theme.label)} · {t("{n} temas de jogos de PlayStation", { n: THEMES.filter((th) => !th.standard).length })}
        </span>
      </span>
      <span className="text-muted">›</span>
    </button>
  );
}

/** Salva e aplica o tema na hora (aplica direto também, sem depender só do aviso das configurações). */
function selectTheme(theme: Settings["theme"]) {
  updateSettings({ theme });
  try {
    applyTheme(theme);
  } catch (e) {
    console.error("Tema:", e);
  }
}

/** Tela de temas (Configurações → Temas). A escolha vale na hora. */
export function ThemesPage() {
  const settings = useSettings();
  return (
    <>
      <PageHeader title={t("Temas")} back />
      <div className="px-4 pb-8 pt-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Padrão")}</h2>
        <div className="mb-5 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("Tema padrão")}>
          {sortedThemes(THEMES.filter((th) => th.standard)).map((th) => (
            <ThemeCard
              key={th.value}
              theme={th}
              selected={settings.theme === th.value}
              onSelect={() => selectTheme(th.value)}
            />
          ))}
        </div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Temas de jogos")}</h2>
        <p className="mb-3 text-sm text-muted">
          {t("Cada tema usa as cores do personagem principal de um jogo de PlayStation.")}
        </p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("Tema")}>
          {sortedThemes(THEMES.filter((th) => !th.standard)).map((th) => (
            <ThemeCard
              key={th.value}
              theme={th}
              selected={settings.theme === th.value}
              onSelect={() => selectTheme(th.value)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Miniatura de uma tela no tema: barra de cima, fundo, cartão com texto e
 * botão de destaque, e barra de baixo. O Automático mostra metade clara e
 * metade escura.
 */
function ThemeSwatch({ theme, className = "" }: { theme: (typeof THEMES)[number]; className?: string }) {
  if (theme.value === "auto") {
    const light = THEMES.find((th) => th.value === "claro")!;
    const dark = THEMES.find((th) => th.value === "escuro")!;
    return (
      <span className={`relative flex overflow-hidden rounded-lg border border-line ${className}`}>
        <MiniScreen theme={light} className="w-1/2" />
        <MiniScreen theme={dark} className="w-1/2" />
        <span className="absolute inset-0 flex items-center justify-center text-base" aria-hidden>
          <span className="rounded-full bg-black/60 px-1.5 text-white">◐</span>
        </span>
      </span>
    );
  }
  return <MiniScreen theme={theme} className={`overflow-hidden rounded-lg border border-line ${className}`} />;
}

function MiniScreen({ theme, className = "" }: { theme: (typeof THEMES)[number]; className?: string }) {
  const [bg, card, accent] = theme.swatch;
  const bars = theme.bars ?? bg;
  const light = isLightColor(bg);
  const ink = light ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.7)";
  const barInk = isLightColor(bars) ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.7)";
  return (
    <span className={`flex flex-col ${className}`} style={{ background: bg }}>
      <span className="flex h-2.5 items-center px-1" style={{ background: bars }}>
        <span className="block h-0.5 w-1/3 rounded-full" style={{ background: barInk }} />
      </span>
      <span className="flex flex-1 flex-col justify-center gap-1 p-1.5">
        <span
          className="flex items-center gap-1 rounded-sm p-1"
          style={{ background: card, boxShadow: card === bg ? `inset 0 0 0 1px ${ink}` : undefined }}
        >
          <span className="block h-1 flex-1 rounded-full" style={{ background: ink }} />
          <span className="block h-2 w-4 rounded-sm" style={{ background: accent }} />
        </span>
      </span>
      <span className="block h-2" style={{ background: bars }} />
    </span>
  );
}

/** Cor clara (para escolher traços escuros ou claros na miniatura). */
function isLightColor(hex: string): boolean {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** Temas em ordem alfabética (pelo nome no idioma atual). */
function sortedThemes(list: typeof THEMES) {
  const collator = new Intl.Collator(locale(), { sensitivity: "base" });
  return [...list].sort((a, b) => collator.compare(t(a.label), t(b.label)));
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
        <span className="text-sm font-semibold">{t(theme.label)}</span>
        {selected && <span className="text-ps-blue-2">✓</span>}
      </span>
      <span className="block text-[0.6875rem] leading-tight text-muted">{t(theme.description)}</span>
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
        {t("Baixar e instalar")}
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
      setState({ step: "error", message: e instanceof Error ? e.message : t("Falha no download.") });
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
          {state.percent >= 0
            ? t("Baixando… {percent}% · {mb} MB", { percent: state.percent, mb })
            : t("Baixando… {mb} MB", { mb })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state.step === "installing" && (
        <p className="text-xs text-ps-blue-2">
          {t("Download concluído. Confirme a instalação na tela do Android.")}
        </p>
      )}
      {state.step === "permission" && (
        <p className="text-xs text-gold">
          {t(
            "Permita que o PlayStation Trophy Mania instale apps (na tela que abriu), volte e toque em “Baixar e instalar” de novo.",
          )}
        </p>
      )}
      {state.step === "error" && (
        <p className="text-xs text-red-400">
          {state.message}{" "}
          <a href={url} target="_blank" rel="noreferrer" className="underline">
            {t("Baixar pelo navegador")}
          </a>
        </p>
      )}
      <button onClick={start} className="block w-full rounded-xl bg-ps-blue py-2.5 text-center text-sm font-semibold">
        {state.step === "idle" ? t("Baixar e instalar") : t("Baixar e instalar de novo")}
      </button>
    </div>
  );
}

function UpdateStatus({ result }: { result: UpdateResult }) {
  if (result.status === "up-to-date") {
    return (
      <p className="border-t border-line px-4 py-3 text-sm text-ps-blue-2">{t("✓ Você está na versão mais recente.")}</p>
    );
  }
  if (result.status === "available") {
    return (
      <div className="space-y-2 border-t border-line px-4 py-3">
        <p className="text-sm font-semibold">
          {t("Nova versão disponível: {version}", { version: `build ${result.latest}` })}
        </p>
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
        {t("Abrir versões no GitHub")}
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

const PRIVACY_URL = "https://github.com/hellisonvidal/Trophy-Mania/blob/main/docs/privacidade.md";

/**
 * Recursos online (opcionais): curtidas que o dono vê e pedidos de boost
 * direto no app. Ao ligar, o ID da PSN é confirmado no servidor do app.
 */
function CloudSettings({ demo, onMessage }: { demo: boolean; onMessage: (m: string) => void }) {
  const { identity, ready } = useCloud();
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await action();
      onMessage(ok);
    } catch {
      onMessage(t("Não foi possível conectar agora. Tente de novo em instantes."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm">
        {identity ? t("🌐 Conectado como {name}", { name: identity.onlineId }) : t("🌐 Desligados")}
      </p>
      <p className="text-xs text-muted">
        {t(
          "Com os recursos online, suas curtidas chegam ao dono da conquista e os pedidos de boost vão direto para o app dos amigos que também usam o Trophy Mania. Ficam guardados no servidor do app só seu ID e avatar da PSN, suas curtidas e seus pedidos de boost.",
        )}{" "}
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="text-ps-blue-2 underline">
          {t("Política de privacidade")}
        </a>
      </p>
      {demo ? (
        <p className="text-xs text-muted">{t("Disponível ao entrar com a PSN (não funciona no modo demonstração).")}</p>
      ) : identity ? (
        <button
          disabled={busy}
          onClick={() => run(disconnectCloud, t("Recursos online desligados neste celular."))}
          className="w-full rounded-xl border border-line py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {t("Desligar recursos online")}
        </button>
      ) : (
        <button
          disabled={busy || !ready}
          onClick={() => run(connectCloud, t("Recursos online ligados!"))}
          className="w-full rounded-xl bg-ps-blue py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? t("Conectando…") : t("Ligar recursos online")}
        </button>
      )}
    </div>
  );
}
