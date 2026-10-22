import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ExitToast, useDoubleBackToExit } from "./lib/backButton";
import { t } from "./i18n";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { importBoost } from "./lib/boostInbox";
import { ALL_ID, storeRegionForCountry } from "./lib/store";
import { storeCategory } from "./psn/store";
import { runBackgroundChecks } from "./lib/checks";
import { onInAppNotice, onNotificationTap, type InAppNotice } from "./lib/notify";
import { getSettings, updateSettings, useSettings } from "./lib/settings";
import { hasSession, signOut as clearSession } from "./psn/auth";
import { createPsnClient } from "./psn/client";
import { createDemoClient } from "./psn/demo";
import type { PsnClient } from "./psn/types";
import { CloudNotice } from "./components/CloudNotice";
import { disconnectCloud } from "./lib/cloud";
import { WhatsNewOnUpdate } from "./components/WhatsNew";
import { ControllerIcon, FriendsIcon, ProfileIcon, StatsIcon, StoreIcon } from "./components/icons";
import { ActivityPage } from "./pages/Activity";
import { FriendsPage } from "./pages/Friends";
import { GamePage } from "./pages/Game";
import { LoginPage, skipSilentLogin } from "./pages/Login";
import { ProfilePage } from "./pages/Profile";
import { SettingsPage, ThemesPage } from "./pages/Settings";
import { StorePage } from "./pages/Store";
import { StatsPage } from "./pages/Stats";
import { persistRemove, persistSet } from "./lib/persist";

type Mode = "psn" | "demo";
const MODE_KEY = "tm.mode" as const;

interface AppState {
  client: PsnClient;
  mode: Mode;
  signOut: (reason?: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp fora do App");
  return ctx;
}

function initialMode(): Mode | null {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "demo") return "demo";
    if (saved === "psn" && hasSession()) return "psn";
  } catch {}
  return null;
}

export function App() {
  const [mode, setMode] = useState<Mode | null>(initialMode);
  // Já havia sessão ao abrir o app: é uma atualização (não uma instalação nova).
  const [hadSession] = useState(() => initialMode() !== null);
  const [notice, setNotice] = useState<string | null>(null);

  const state = useMemo<AppState | null>(() => {
    if (!mode) return null;
    return {
      mode,
      client: mode === "demo" ? createDemoClient() : createPsnClient(),
      signOut: (reason) => {
        // Sem motivo = o usuário tocou em "Sair": esquece também a conta da Sony,
        // a não ser que ele tenha pedido para lembrar (Configurações → Conta).
        clearSession(!reason && !getSettings().keepSonyLogin);
        if (!reason) {
          // Saiu por vontade própria: não entra de novo sozinho, e a identidade
          // dos recursos online não passa para a próxima conta.
          skipSilentLogin();
          void disconnectCloud();
        }
        persistRemove(MODE_KEY);
        setNotice(reason ?? null);
        setMode(null);
      },
    };
  }, [mode]);

  if (!state) {
    return (
      <LoginPage
        notice={notice}
        onSignedIn={(m) => {
          persistSet(MODE_KEY, m);
          if (m === "psn" && !getSettings().signedInBefore) updateSettings({ signedInBefore: true });
          setNotice(null);
          setMode(m);
        }}
      />
    );
  }

  return (
    <AppContext.Provider value={state}>
      <HashRouter>
        <StartTab />
        <BackButton />
        <BoostLinks />
        <BackgroundChecks />
        <AccountStoreRegion />
        <StorePreload />
        <NotificationLinks />
        <InAppNotices />
        <WhatsNewOnUpdate updated={hadSession} waitCloudNotice={state.mode === "psn"} />
        {state.mode === "psn" && <CloudNotice />}
        {/* Espaço no fim para o conteúdo não ficar atrás das abas e da barra de navegação do Android. */}
        <div className="safe-top mx-auto min-h-[100dvh] max-w-2xl pb-[calc(6rem+var(--sab))]">
          {state.mode === "demo" && (
            <div className="bg-gold/15 px-4 py-2 text-center text-xs text-gold">
              {t("Modo demonstração")} ·{" "}
              <button className="underline" onClick={() => state.signOut()}>
                {t("entrar com a PSN")}
              </button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<ProfilePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/ranking" element={<Navigate to="/stats?view=ranking" replace />} />
            <Route path="/store" element={<StorePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/themes" element={<ThemesPage />} />
            <Route path="/u/me" element={<Navigate to="/" replace />} />
            <Route path="/u/:accountId" element={<ProfilePage />} />
            <Route path="/game/:accountId/:gameId" element={<GamePage />} />
          </Routes>
        </div>
        <TabBar />
      </HashRouter>
    </AppContext.Provider>
  );
}

/** Voltar do Android: nas abas principais, dois toques fecham o app. */
const TAB_PATHS = new Set(["/", "/stats", "/friends", "/activity", "/store"]);
function BackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const warning = useDoubleBackToExit(
    () => !TAB_PATHS.has(pathname),
    () => navigate(-1),
  );
  return <ExitToast show={warning} />;
}

/**
 * Links de pedido de boost (plathunt://boost?d=…, ou trophymania:// dos links antigos): guardam o pedido em
 * "Pedidos recebidos" e abrem essa tela.
 */
let launchUrlHandled = false;

function BoostLinks() {
  const navigate = useNavigate();
  const { client } = useApp();
  useEffect(() => {
    const open = async (url: string | undefined) => {
      if (!url || !/^(plathunt|trophymania):\/\/boost/.test(url)) return;
      const me = await client.me().catch(() => null);
      const result = importBoost(url, me?.onlineId ?? null);
      navigate(`/activity?view=boost-inbox${result.ok ? `&pedido=${encodeURIComponent(result.request.id)}` : ""}`);
    };
    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      // O link que abriu o app vale uma vez só (trocar o idioma ou de conta remonta o app).
      if (!launchUrlHandled) {
        launchUrlHandled = true;
        void CapApp.getLaunchUrl()
          .then((launch) => open(launch?.url))
          .catch(() => {});
      }
      void CapApp.addListener("appUrlOpen", ({ url }) => void open(url)).then((h) => (remove = () => void h.remove()));
    }
    return () => remove?.();
  }, [client, navigate]);
  return null;
}

/** Tocar numa notificação abre a tela dela (méritos, desafios, boost, jogo do amigo...). */
function NotificationLinks() {
  const navigate = useNavigate();
  useEffect(() => onNotificationTap((route) => navigate(route)), [navigate]);
  return null;
}

/**
 * Avisos dentro do app: com o app aberto, as notificações aparecem no topo da
 * tela; tocar leva à tela do aviso (pedido de boost, desafio, mérito...).
 */
function InAppNotices() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState<InAppNotice | null>(null);
  useEffect(() => onInAppNotice(setNotice), []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <div className="safe-top safe-x pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-2">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-xl animate-[sheet-up_200ms_ease-out] items-center gap-3 rounded-2xl border border-ps-blue-2/40 bg-surface p-3 shadow-2xl"
      >
        <button
          onClick={() => {
            setNotice(null);
            navigate(notice.route);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-sm font-semibold">{notice.title}</span>
          <span className="block truncate text-xs text-muted">{notice.body}</span>
          <span className="mt-0.5 block text-[0.6875rem] font-semibold text-ps-blue-2">{t("Toque para abrir")}</span>
        </button>
        <button onClick={() => setNotice(null)} aria-label={t("Fechar")} className="shrink-0 px-1 text-muted">
          ✕
        </button>
      </div>
    </div>
  );
}

/** Verificações para as notificações: ao abrir o app e ao voltar para ele. */
function BackgroundChecks() {
  const { client, mode } = useApp();
  useEffect(() => {
    if (mode === "demo") return;
    const run = () => void runBackgroundChecks(client).catch(() => {});
    const timer = setTimeout(run, 5000);
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [client, mode]);
  return null;
}

/**
 * Deixa a loja pronta: alguns segundos depois de abrir o app, carrega o
 * catálogo em segundo plano e salva no celular, mas só se a cópia salva já
 * venceu (intervalo escolhido em Configurações → Loja).
 */
function StorePreload() {
  const { mode } = useApp();
  useEffect(() => {
    if (mode === "demo") return;
    const timer = setTimeout(() => {
      void storeCategory(ALL_ID, getSettings().storeRegion).catch(() => {});
    }, 8000);
    return () => clearTimeout(timer);
  }, [mode]);
  return null;
}

/**
 * A Loja segue o país da conta da PSN (moeda e preços certos para quem tem
 * conta de outro país), a menos que o usuário tenha escolhido um país à mão.
 */
function AccountStoreRegion() {
  const { mode, client } = useApp();
  const { storeRegionAuto } = useSettings();
  useEffect(() => {
    if (mode !== "psn" || !storeRegionAuto) return;
    let alive = true;
    void client.accountCountry().then((country) => {
      const region = storeRegionForCountry(country);
      if (alive && region && getSettings().storeRegionAuto && getSettings().storeRegion !== region) {
        updateSettings({ storeRegion: region });
      }
    });
    return () => {
      alive = false;
    };
  }, [mode, client, storeRegionAuto]);
  return null;
}

/** Abre o app na aba escolhida em Configurações (só ao iniciar). */
let startHandled = false;
function StartTab() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (startHandled) return;
    startHandled = true;
    const { startTab } = getSettings();
    if (pathname === "/" && startTab !== "/") navigate(startTab, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

const TABS = [
  { to: "/", icon: <ProfileIcon />, label: "Perfil" },
  { to: "/stats", icon: <StatsIcon />, label: "Estatísticas" },
  { to: "/friends", icon: <FriendsIcon />, label: "Amigos" },
  { to: "/activity", icon: <ControllerIcon />, label: "Atividades" },
  { to: "/store", icon: <StoreIcon />, label: "Loja" },
];

function TabBar() {
  return (
    <nav className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[0.625rem] ${isActive ? "text-ps-blue-2" : "text-muted"}`
            }
          >
            <span className="flex h-6 items-center">{tab.icon}</span>
            {t(tab.label)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
