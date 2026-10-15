"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="mt-2 space-y-3">
      <input
        name="npsso"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder='{"npsso":"…"}'
        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-ps-blue-2"
      />
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-xl bg-ps-blue py-2.5 font-semibold hover:bg-ps-blue-2 disabled:opacity-60"
      >
        {pending ? "Conectando à PSN e importando troféus…" : "Entrar"}
      </button>
    </form>
  );
}
