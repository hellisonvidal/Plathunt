import { useState } from "react";
import { Link } from "react-router-dom";
import { filterByPlatform, formatDuration, withEarnedTrophies, type PlayedOn } from "../lib/stats";
import type { Title } from "../psn/types";
import { SERIES_COLORS } from "./charts";
import { RemoteImage } from "./ui";

/** Categorias das Estatísticas que abrem um mural de jogos. */
export type MuralCategory = "jogos" | "platinas" | "completos" | "conclusao" | "trofeus" | "tempo";

export const MURAL_LABELS: Record<MuralCategory, string> = {
  jogos: "Jogos",
  platinas: "Platinas",
  completos: "Jogos 100%",
  conclusao: "Conclusão média",
  trofeus: "Troféus",
  tempo: "Tempo de jogo",
};

export interface MuralPlayer {
  name: string;
  accountId: string;
  titles: Title[];
  playtime: Map<string, number>;
  playedOn: PlayedOn;
}

const total = (t: Title) => t.earned.platinum + t.earned.gold + t.earned.silver + t.earned.bronze;
const recent = (a: Title, b: Title) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();

/** Jogos de uma categoria, já ordenados, com o número que aparece no cartão. */
export function muralTiles(
  category: MuralCategory,
  player: MuralPlayer,
  platform: string | null,
): { title: Title; metric: string }[] {
  const titles = filterByPlatform(withEarnedTrophies(player.titles), platform, player.playedOn);
  const pct = (t: Title) => `${t.progress}%`;
  switch (category) {
    case "jogos":
      return [...titles].sort(recent).map((t) => ({ title: t, metric: pct(t) }));
    case "platinas":
      return titles
        .filter((t) => t.earned.platinum > 0)
        .sort(recent)
        .map((t) => ({ title: t, metric: "Platina" }));
    case "completos":
      return titles
        .filter((t) => t.progress >= 100)
        .sort(recent)
        .map((t) => ({ title: t, metric: "100%" }));
    case "conclusao":
      return [...titles].sort((a, b) => b.progress - a.progress || recent(a, b)).map((t) => ({ title: t, metric: pct(t) }));
    case "trofeus":
      return [...titles]
        .sort((a, b) => total(b) - total(a))
        .map((t) => ({ title: t, metric: `${total(t).toLocaleString("pt-BR")} troféus` }));
    case "tempo":
      return titles
        .filter((t) => (player.playtime.get(t.id) ?? 0) > 0)
        .sort((a, b) => (player.playtime.get(b.id) ?? 0) - (player.playtime.get(a.id) ?? 0))
        .map((t) => ({ title: t, metric: formatDuration(player.playtime.get(t.id) ?? 0) }));
  }
}

/** Quantos cartões aparecem antes do "ver todos". */
const PREVIEW = 12;

/**
 * Mural da categoria escolhida nas Estatísticas: as capas dos jogos que
 * entram nela, de você e (se estiver comparando) do amigo.
 */
export function Mural({
  category,
  players,
  platform,
}: {
  category: MuralCategory;
  players: MuralPlayer[];
  platform: string | null;
}) {
  const [who, setWho] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const index = Math.min(who, players.length - 1);
  const player = players[index];
  const tiles = muralTiles(category, player, platform);
  const shown = showAll ? tiles : tiles.slice(0, PREVIEW);

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Mural · {MURAL_LABELS[category]}</h2>
        <span className="text-xs text-muted">
          {tiles.length} {tiles.length === 1 ? "jogo" : "jogos"}
          {platform && ` · ${platform}`}
        </span>
      </div>

      {players.length > 1 && (
        <div className="flex gap-2 text-sm" role="tablist" aria-label="Jogador">
          {players.map((p, i) => (
            <button
              key={p.accountId}
              role="tab"
              aria-selected={i === index}
              onClick={() => {
                setWho(i);
                setShowAll(false);
              }}
              className={`flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 ${
                i === index ? "bg-surface-2 font-semibold" : "border border-line text-muted"
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SERIES_COLORS[i] }} />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {tiles.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhum jogo nesta categoria por enquanto.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {shown.map(({ title, metric }) => (
            <li key={title.id}>
              <Link
                to={`/game/${player.accountId}/${title.id}?service=${title.service}`}
                className={`block overflow-hidden rounded-xl border bg-surface-2 ${
                  title.earned.platinum > 0 ? "border-platinum/60" : "border-line"
                }`}
              >
                <RemoteImage
                  src={title.iconUrl}
                  alt=""
                  className="aspect-square w-full object-cover"
                  fallback={
                    <span className="flex aspect-square w-full items-center justify-center text-3xl" aria-hidden>
                      🎮
                    </span>
                  }
                />
                <span className="block px-1.5 pb-1.5 pt-1">
                  <span className="line-clamp-2 text-[0.6875rem] font-semibold leading-tight">{title.name}</span>
                  <span
                    className={`mt-0.5 block text-[0.6875rem] tabular-nums ${
                      category === "platinas" ? "text-platinum" : "text-muted"
                    }`}
                  >
                    {metric}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {tiles.length > PREVIEW && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="w-full rounded-xl py-2 text-sm font-semibold text-ps-blue-2 active:bg-surface-2"
        >
          {showAll ? "Mostrar menos" : `Ver todos os ${tiles.length}`}
        </button>
      )}
    </section>
  );
}
