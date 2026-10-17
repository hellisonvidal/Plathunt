import { useState } from "react";
import { t } from "../i18n";
import { PLAYSTATION_REACTIONS, STANDARD_REACTIONS, useReactions } from "../lib/reactions";
import { PS_BUTTONS } from "./icons";

export function ReactionGlyph({ reaction }: { reaction: string }) {
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

/** Barra de curtidas com emojis padrão e os da PlayStation. */
export function ReactionBar({ itemKey }: { itemKey: string }) {
  const { mine, toggle } = useReactions(itemKey);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
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
