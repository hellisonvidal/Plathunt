import { describe, expect, it } from "vitest";
import { isReactionEmoji, summarizeReactions } from "@/lib/social-constants";

describe("summarizeReactions", () => {
  it("agrupa por emoji, marca as do espectador e segue a ordem da paleta", () => {
    const r = summarizeReactions(
      [
        { emoji: "🔥", userId: "u2" },
        { emoji: "🏆", userId: "u1" },
        { emoji: "🔥", userId: "u1" },
        { emoji: "🔥", userId: "u3" },
      ],
      "u2",
    );
    expect(r).toEqual([
      { emoji: "🏆", count: 1, mine: false },
      { emoji: "🔥", count: 3, mine: true },
    ]);
  });

  it("valida emojis permitidos", () => {
    expect(isReactionEmoji("🔥")).toBe(true);
    expect(isReactionEmoji("💩")).toBe(false);
  });
});
