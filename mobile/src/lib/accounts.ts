import { useEffect, useState } from "react";
import { clearCache } from "./cache";
import { cancelAllNotifications } from "./notify";
import { ACCOUNT_KEYS, clearAccountData, persistRemove, persistSet } from "./persist";

/**
 * Várias contas da PSN no mesmo celular. A conta ativa usa as chaves normais
 * (tm.session, tm.challenges…); as outras ficam guardadas aqui, cada uma com
 * a cópia dos próprios dados. Trocar de conta guarda a ativa, devolve os dados
 * da escolhida às chaves normais e recarrega o app.
 */
export interface SavedAccount {
  accountId: string;
  onlineId: string;
  avatarUrl: string | null;
  data: Record<string, string>;
}

const KEY = "tm.accounts" as const;
/** Chaves da conta: login (tokens), dados da conta e verificações em segundo plano. */
const SNAPSHOT_KEYS = ["tm.session", ...ACCOUNT_KEYS, "tm.checks"];
/** Depois de recarregar para adicionar conta, o login não entra sozinho na conta anterior. */
const FRESH_LOGIN = "tm.freshLogin";
const listeners = new Set<() => void>();

export function savedAccounts(): SavedAccount[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: SavedAccount[]) {
  if (list.length) persistSet(KEY, JSON.stringify(list));
  else persistRemove(KEY);
  listeners.forEach((l) => l());
}

export function useSavedAccounts(): SavedAccount[] {
  const [list, setList] = useState(savedAccounts);
  useEffect(() => {
    const update = () => setList(savedAccounts());
    listeners.add(update);
    return () => void listeners.delete(update);
  }, []);
  return list;
}

/** Guarda a conta ativa (com os dados dela) e deixa o app sem conta ativa. */
export function stashActive(me: { accountId: string; onlineId: string; avatarUrl: string | null }) {
  const data: Record<string, string> = {};
  for (const key of SNAPSHOT_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  if (data["tm.session"]) {
    write([{ ...me, data }, ...savedAccounts().filter((a) => a.accountId !== me.accountId)]);
  }
  persistRemove("tm.session");
  clearAccountData();
  clearCache();
  void cancelAllNotifications().catch(() => {});
}

/** Devolve os dados de uma conta guardada às chaves normais (vira a conta ativa). */
export function restoreAccount(accountId: string): boolean {
  const account = savedAccounts().find((a) => a.accountId === accountId);
  if (!account) return false;
  for (const [key, value] of Object.entries(account.data)) {
    if (key === "tm.checks") localStorage.setItem(key, value);
    else persistSet(key as (typeof ACCOUNT_KEYS)[number] | "tm.session", value);
  }
  forgetSaved(accountId);
  return true;
}

/** Tira uma conta da lista (entrou de novo nela, ou o usuário a removeu). */
export function forgetSaved(accountId: string) {
  write(savedAccounts().filter((a) => a.accountId !== accountId));
}

export function markFreshLogin() {
  try {
    sessionStorage.setItem(FRESH_LOGIN, "1");
  } catch {}
}

/** Lê e apaga a marca de "adicionar conta" (vale para um login só). */
export function takeFreshLogin(): boolean {
  try {
    const fresh = sessionStorage.getItem(FRESH_LOGIN) === "1";
    sessionStorage.removeItem(FRESH_LOGIN);
    return fresh;
  } catch {
    return false;
  }
}

type Me = { accountId: string; onlineId: string; avatarUrl: string | null };

/** Guarda a conta ativa; false se não deu para saber qual é (sem internet e sem perfil salvo). */
async function stashCurrent(me: (() => Promise<Me>) | null): Promise<boolean> {
  if (!me) return true;
  const profile = await me().catch(() => null);
  if (!profile) return false;
  stashActive(profile);
  return true;
}

/** Troca para uma conta guardada. `me` é o perfil da conta ativa (null sem conta da PSN ativa). */
export async function switchAccount(accountId: string, me: (() => Promise<Me>) | null): Promise<boolean> {
  if (!savedAccounts().some((a) => a.accountId === accountId)) return false;
  if (!(await stashCurrent(me))) return false;
  restoreAccount(accountId);
  persistSet("tm.mode", "psn");
  window.location.reload();
  return true;
}

/** Guarda a conta ativa e abre a tela de entrada para outra conta (a Sony pede o login de novo). */
export async function addAccount(me: () => Promise<Me>, forgetSony: () => void): Promise<boolean> {
  if (!(await stashCurrent(me))) return false;
  forgetSony();
  persistRemove("tm.mode");
  markFreshLogin();
  window.location.reload();
  return true;
}
