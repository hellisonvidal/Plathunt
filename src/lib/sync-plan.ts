/** Lógica pura da sincronização (sem I/O), separada para ser testável. */

export interface RemoteTitleRef {
  id: string;
  lastUpdatedAt: Date;
}

/**
 * Escolhe quais jogos precisam ter os troféus individuais baixados: aqueles
 * cujo progresso mudou desde a última sincronização. Os mais recentes vêm
 * primeiro e o total é limitado para respeitar o rate limit da PSN — o resto
 * fica para as próximas sincronizações.
 */
export function titlesNeedingTrophySync(
  remote: RemoteTitleRef[],
  syncedAt: Map<string, Date | null>,
  max: number,
): string[] {
  return remote
    .filter((t) => {
      const last = syncedAt.get(t.id);
      return !last || last.getTime() < t.lastUpdatedAt.getTime();
    })
    .sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime())
    .slice(0, max)
    .map((t) => t.id);
}

export function trophyKey(npCommunicationId: string, trophyId: number): string {
  return `${npCommunicationId}:${trophyId}`;
}

/** "12.5" → 12.5; valores inválidos viram null. */
export function parseEarnedRate(rate: string | undefined): number | null {
  if (rate === undefined) return null;
  const n = Number.parseFloat(rate);
  return Number.isFinite(n) ? n : null;
}
