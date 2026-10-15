import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ExitToast, useDoubleBackToExit } from "./lib/backButton";
import { getSettings } from "./lib/settings";
import { hasSession, signOut as clearSession } from "./psn/auth";
import { createPsnClient } from "./psn/client";
import { createDemoClient } from "./psn/demo";
import type { PsnClient } from "./psn/types";
import { ControllerIcon, FriendsIcon, ProfileIcon, RankingIcon, StatsIcon } from "./components/icons";
import { ActivityPage } from "./pages/Activity";
import { FriendsPage } from "./pages/Friends";
import { GamePage } from "./pages/Game";
import { LoginPage } from "./pages/Login";
import { ProfilePage } from "./pages/Profile";
import { RankingPage } from "./pages/Ranking";
import { SettingsPage } from "./pages/Settings";
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
  const [notice, setNotice] = useState<string | null>(null);

  const state = useMemo<AppState | null>(() => {
    if (!mode) return null;
    return {
      mode,
      client: mode === "demo" ? createDemoClient() : createPsnClient(),
      signOut: (reason) => {
        // Sem motivo = o usuário tocou em "Sair": esquece também a conta da Sony.
        clearSession(!reason);
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
        <div className="safe-top mx-auto min-h-screen max-w-2xl pb-24">
          {state.mode === "demo" && (
            <div className="bg-gold/15 px-4 py-2 text-center text-xs text-gold">
              Modo demonstração ·{" "}
              <button className="underline" onClick={() => state.signOut()}>
                entrar com a PSN
              </button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<ProfilePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
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
const TAB_PATHS = new Set(["/", "/stats", "/friends", "/activity", "/ranking"]);
function BackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const warning = useDoubleBackToExit(
    () => !TAB_PATHS.has(pathname),
    () => navigate(-1),
  );
  return <ExitToast show={warning} />;
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
  { to: "/ranking", icon: <RankingIcon />, label: "Ranking" },
];

function TabBar() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10px] ${isActive ? "text-ps-blue-2" : "text-muted"}`
            }
          >
            <span className="flex h-6 items-center">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
