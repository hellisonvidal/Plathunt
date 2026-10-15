"use client";

import { useState, useTransition } from "react";
import { syncAction } from "@/app/actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await syncAction();
            setMessage(r.message);
          })
        }
        className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-muted disabled:opacity-50"
      >
        {pending ? "Sincronizando…" : "⟳ Sincronizar com a PSN"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
