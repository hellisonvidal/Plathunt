import { useState } from "react";
import { t } from "../i18n";
import { PLAYSTATION_REACTIONS, STANDARD_REACTIONS, useReactions } from "../lib/reactions";
import { PS_BUTTONS } from "./icons";

export function ReactionGlyph({ reaction }: { reaction: string }) {
  if (reaction === "ps:platinum") {
    return (
      <svg viewBox="0 0 24 24" className="inline-block h-[1.1em] w-[1.1em] align-[-0.15em]" role="img" aria-label={t("Troféu de platina")}>
        <defs>
          <linearGradient id="reaction-platinum" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9f6ff" />
            <stop offset="0.5" stopColor="#a8d8f0" />
            <stop offset="1" stopColor="#5f9fc9" />
          </linearGradient>
        </defs>
        <path
          fill="url(#reaction-platinum)"
          stroke="#3f7fae"
          strokeWidth="0.8"
          d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z"
        />
      </svg>
    );
  }
  const ps = PS_BUTTONS[reaction as keyof typeof PS_BUTTONS];
  if (ps) {
    return (
      <span className="font-bold" style={{ color: ps.color }} aria-label={ps.label}>
        {ps.glyph}
      </span>
    );
  }
  return <span>{reaction}</span>;
}

/** Curtidas de outros jogadores (recursos online): emoji e quem curtiu. */
export interface OtherLike {
  reaction: string;
  name: string;
}

/** Barra de curtidas com emojis padrão e os da PlayStation. */
export function ReactionBar({
  itemKey,
  ownerAccountId,
  others = [],
}: {
  itemKey: string;
  ownerAccountId?: string;
  others?: OtherLike[];
}) {
  const { mine, toggle } = useReactions(itemKey, ownerAccountId);
  const [open, setOpen] = useState(false);
  const counts = new Map<string, number>();
  for (const o of others) counts.set(o.reaction, (counts.get(o.reaction) ?? 0) + 1);
  const names = [...new Set(others.map((o) => o.name))];

  return (
    <div className="mt-3">
      {others.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
          {[...counts].map(([r, n]) => (
            <span key={r} className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5">
              <ReactionGlyph reaction={r} /> <span className="font-semibold">{n}</span>
            </span>
          ))}
          <span className="min-w-0 truncate text-muted">
            {names.length <= 2
              ? t("curtido por {names}", { names: names.join(", ") })
              : t("curtido por {names} e mais {n}", { names: names.slice(0, 2).join(", "), n: names.length - 2 })}
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {mine.map((r) => (
          <button
            key={r}
            onClick={() => toggle(r)}
            aria-pressed
            className="flex h-8 min-w-10 items-center justify-center rounded-full border border-ps-blue-2 bg-ps-blue/20 px-2.5 text-base"
          >
            <ReactionGlyph reaction={r} />
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={t("Curtir com emoji")}
          className="flex h-8 items-center gap-1 rounded-full border border-dashed border-line px-3 text-sm text-muted"
        >
          {mine.length ? "＋" : t("😀 Curtir")}
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-2xl border border-line bg-surface-2 p-2">
          <Row reactions={STANDARD_REACTIONS} mine={mine} onPick={(r) => (toggle(r), setOpen(false))} />
          <p className="mb-1 mt-2 px-1 text-[0.6875rem] uppercase tracking-wide text-muted">PlayStation</p>
          <Row reactions={PLAYSTATION_REACTIONS} mine={mine} onPick={(r) => (toggle(r), setOpen(false))} />
        </div>
      )}
    </div>
  );
}

function Row({
  reactions,
  mine,
  onPick,
}: {
  reactions: readonly string[];
  mine: string[];
  onPick: (r: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {reactions.map((r) => (
        <button
          key={r}
          onClick={() => onPick(r)}
          aria-pressed={mine.includes(r)}
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${
            mine.includes(r) ? "bg-ps-blue/30" : "active:bg-surface"
          }`}
        >
          <ReactionGlyph reaction={r} />
        </button>
      ))}
    </div>
  );
}
