"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { congratulateAction, deleteCongratulationAction, toggleReactionAction } from "@/app/actions";
import type { FeedItem } from "@/lib/social";
import { CONGRATS_MAX_LENGTH, QUICK_CONGRATS, REACTION_EMOJIS } from "@/lib/social-constants";
import { Avatar, TrophyBadge, rarityLabel, timeAgo } from "./ui";

type Reactions = FeedItem["reactions"];

function applyToggle(reactions: Reactions, emoji: string): Reactions {
  const current = reactions.find((r) => r.emoji === emoji);
  if (!current) {
    const next = [...reactions, { emoji, count: 1, mine: true }];
    return REACTION_EMOJIS.flatMap((e) => next.filter((r) => r.emoji === e));
  }
  if (current.mine) {
    return reactions
      .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r))
      .filter((r) => r.count > 0);
  }
  return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
}

export function ActivityCard({ item, viewerOnlineId }: { item: FeedItem; viewerOnlineId: string }) {
  const [reactions, toggleOptimistic] = useOptimistic(item.reactions, applyToggle);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const isPlatinum = item.trophy.type === "platinum";

  function react(emoji: string) {
    setPickerOpen(false);
    startTransition(async () => {
      toggleOptimistic(emoji);
      await toggleReactionAction(item.id, emoji);
    });
  }

  function sendCongrats(text: string) {
    const value = text.trim();
    if (!value) return;
    startTransition(async () => {
      await congratulateAction(item.id, value);
      setMessage("");
    });
  }

  const rarity = rarityLabel(item.earnedRate);

  return (
    <article
      className={`rounded-2xl border bg-surface p-4 ${
        isPlatinum ? "border-platinum/50 shadow-[0_0_24px_-8px] shadow-platinum/40" : "border-line"
      }`}
    >
      <header className="flex items-center gap-3">
        <Link href={`/u/${item.user.onlineId}`}>
          <Avatar src={item.user.avatarUrl} name={item.user.onlineId} />
        </Link>
        <div className="min-w-0 flex-1 text-sm">
          <p>
            <Link href={`/u/${item.user.onlineId}`} className="font-semibold hover:underline">
              {item.isMine ? "Você" : item.user.onlineId}
            </Link>{" "}
            {isPlatinum ? "platinou" : "conquistou um troféu em"}{" "}
            <Link href={`/games/${item.game.npCommunicationId}`} className="font-semibold hover:underline">
              {item.game.name}
            </Link>
          </p>
          <p className="text-xs text-muted">
            {timeAgo(item.earnedAt)} · {item.game.platform}
          </p>
        </div>
      </header>

      <div className="mt-3 flex gap-3 rounded-xl bg-surface-2 p-3">
        {item.trophy.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.trophy.iconUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{item.trophy.name}</h3>
            <TrophyBadge type={item.trophy.type} />
          </div>
          {item.trophy.detail && <p className="mt-1 text-sm text-muted">{item.trophy.detail}</p>}
          {rarity && <p className="mt-1 text-xs text-ps-blue-2">{rarity}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {reactions.map((r) => (
          <button
            key={r.emoji}
            onClick={() => react(r.emoji)}
            className={`rounded-full border px-2.5 py-1 text-sm transition ${
              r.mine ? "border-ps-blue-2 bg-ps-blue/20" : "border-line bg-surface-2 hover:border-muted"
            }`}
            aria-pressed={r.mine}
          >
            {r.emoji} <span className="text-muted">{r.count}</span>
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="rounded-full border border-dashed border-line px-2.5 py-1 text-sm text-muted hover:border-muted"
            aria-label="Reagir com emoji"
          >
            😀＋
          </button>
          {pickerOpen && (
            <div className="absolute left-0 z-10 mt-2 flex gap-1 rounded-xl border border-line bg-surface-2 p-2 shadow-xl">
              {REACTION_EMOJIS.map((e) => (
                <button key={e} onClick={() => react(e)} className="rounded-lg p-1.5 text-xl hover:bg-surface">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {item.congrats.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-line pt-3">
          {item.congrats.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <Avatar src={c.user.avatarUrl} name={c.user.onlineId} size={24} />
              <p className="min-w-0 flex-1">
                <Link href={`/u/${c.user.onlineId}`} className="font-semibold hover:underline">
                  {c.user.onlineId}
                </Link>{" "}
                <span className="break-words">{c.message}</span>
                <span className="ml-2 text-xs text-muted">{timeAgo(c.createdAt)}</span>
              </p>
              {c.user.onlineId === viewerOnlineId && (
                <button
                  onClick={() => startTransition(() => deleteCongratulationAction(c.id))}
                  className="text-xs text-muted hover:text-ink"
                >
                  apagar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!item.isMine && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="flex flex-wrap gap-2">
            {(QUICK_CONGRATS[item.trophy.type] ?? QUICK_CONGRATS.bronze).map((q) => (
              <button
                key={q}
                disabled={pending}
                onClick={() => sendCongrats(q)}
                className="rounded-full bg-ps-blue/20 px-3 py-1 text-xs text-ps-blue-2 hover:bg-ps-blue/30 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendCongrats(message);
            }}
            className="flex gap-2"
          >
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={CONGRATS_MAX_LENGTH}
              placeholder={`Dê os parabéns para ${item.user.onlineId}…`}
              className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
            />
            <button
              disabled={pending || !message.trim()}
              className="rounded-full bg-ps-blue px-4 py-2 text-sm font-semibold hover:bg-ps-blue-2 disabled:opacity-50"
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
