/** Emojis permitidos nas reações (lista fechada para manter o feed limpo). */
export const REACTION_EMOJIS = ["🏆", "🔥", "👏", "🎉", "😮", "💪", "😂", "❤️"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}

/** Mensagens rápidas de parabéns, de acordo com o tipo do troféu. */
export const QUICK_CONGRATS: Record<string, string[]> = {
  platinum: ["Platinou! Que monstro! 🏆", "Parabéns pela platina!", "Lenda! 👑"],
  gold: ["Ouro merecido! 🥇", "Mandou bem demais!"],
  silver: ["Boa! 🥈", "Parabéns!"],
  bronze: ["Boa! 👏", "Parabéns!"],
};

export const CONGRATS_MAX_LENGTH = 280;

export function summarizeReactions(
  reactions: { emoji: string; userId: string }[],
  viewerId: string,
): { emoji: string; count: number; mine: boolean }[] {
  const map = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const entry = map.get(r.emoji) ?? { count: 0, mine: false };
    entry.count++;
    if (r.userId === viewerId) entry.mine = true;
    map.set(r.emoji, entry);
  }
  return REACTION_EMOJIS.filter((e) => map.has(e)).map((emoji) => ({ emoji, ...map.get(emoji)! }));
}
