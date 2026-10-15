import { createContext, useContext, useMemo, useState } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { hasSession, signOut as clearSession } from "./psn/auth";
import { createPsnClient } from "./psn/client";
import { createDemoClient } from "./psn/demo";
import type { PsnClient } from "./psn/types";
import { FeedPage } from "./pages/Feed";
import { FriendsPage } from "./pages/Friends";
import { GamePage } from "./pages/Game";
import { LoginPage } from "./pages/Login";
import { ProfilePage } from "./pages/Profile";
import { TrophiesPage } from "./pages/Trophies";

type Mode = "psn" | "demo";
const MODE_KEY = "tm.mode";

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
        localStorage.removeItem(MODE_KEY);
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
          localStorage.setItem(MODE_KEY, m);
          setNotice(null);
          setMode(m);
        }}
      />
    );
  }

  return (
    <AppContext.Provider value={state}>
      <HashRouter>
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
            <Route path="/" element={<FeedPage />} />
            <Route path="/trophies" element={<TrophiesPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/u/:accountId" element={<ProfilePage />} />
            <Route path="/game/:accountId/:gameId" element={<GamePage />} />
          </Routes>
        </div>
        <TabBar />
      </HashRouter>
    </AppContext.Provider>
  );
}

const TABS = [
  { to: "/", icon: "⚡", label: "Atividade" },
  { to: "/trophies", icon: "🏆", label: "Troféus" },
  { to: "/friends", icon: "👥", label: "Amigos" },
  { to: "/u/me", icon: "👤", label: "Perfil" },
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
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${isActive ? "text-ps-blue-2" : "text-muted"}`
            }
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
