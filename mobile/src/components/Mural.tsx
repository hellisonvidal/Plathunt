import { useEffect, useState } from "react";
import { useBackInterceptor } from "../lib/backButton";
import { Link } from "react-router-dom";
import { filterByPlatform, formatDuration, startYear, withEarnedTrophies, type PlayedOn } from "../lib/stats";
import { t } from "../i18n";
import type { Title } from "../psn/types";
import { SERIES_COLORS } from "./charts";
import { RemoteImage } from "./ui";

/** Categorias das Estatísticas que abrem um mural de jogos. */
export type MuralCategory = "jogos" | "platinas" | "completos" | "conclusao" | "trofeus" | "tempo";
/** O que o mural mostra: uma categoria dos quadros ou os jogos de um ano (Jogos por ano). */
export type MuralKind = MuralCategory | { year: number };

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
  /** Primeira vez que jogou cada jogo, para o mural de um ano. */
  firstPlayed?: Map<string, string | null>;
}

const total = (t: Title) => t.earned.platinum + t.earned.gold + t.earned.silver + t.earned.bronze;
const recent = (a: Title, b: Title) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();

/** Jogos de uma categoria, já ordenados, com o número que aparece no cartão. */
export function muralTiles(
  category: MuralKind,
  player: MuralPlayer,
  platform: string | null,
): { title: Title; metric: string }[] {
  const titles = filterByPlatform(withEarnedTrophies(player.titles), platform, player.playedOn);
  const pct = (t: Title) => `${t.progress}%`;
  if (typeof category === "object")
    return titles
      .filter((g) => startYear(g, player.firstPlayed) === category.year)
      .sort(recent)
      .map((g) => ({ title: g, metric: g.earned.platinum > 0 ? t("Platina") : pct(g) }));
  switch (category) {
    case "jogos":
      return [...titles].sort(recent).map((t) => ({ title: t, metric: pct(t) }));
    case "platinas":
      return titles
        .filter((t) => t.earned.platinum > 0)
        .sort(recent)
        .map((g) => ({ title: g, metric: t("Platina") }));
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
        .map((g) => ({ title: g, metric: t("{n} troféus", { n: total(g) }) }));
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
 * Mural da categoria escolhida nas Estatísticas, em um pop-up que sobe da
 * parte de baixo da tela: as capas dos jogos que entram nela, de você e (se
 * estiver comparando) do amigo. Fecha no ✕, tocando fora ou no voltar.
 */
export function Mural({
  category,
  players,
  platform,
  onClose,
}: {
  category: MuralKind;
  players: MuralPlayer[];
  platform: string | null;
  onClose: () => void;
}) {
  useBackInterceptor(true, onClose);
  // A página de trás não rola enquanto o pop-up está aberto.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const [who, setWho] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const index = Math.min(who, players.length - 1);
  const player = players[index];
  const tiles = muralTiles(category, player, platform);
  const shown = showAll ? tiles : tiles.slice(0, PREVIEW);
  const heading =
    typeof category === "object"
      ? t("Jogos de {year}", { year: String(category.year) })
      : t("Mural · {label}", { label: t(MURAL_LABELS[category]) });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" data-no-pull>
      <button aria-label={t("Fechar mural")} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="safe-bottom relative flex max-h-[85dvh] w-full max-w-2xl animate-[sheet-up_200ms_ease-out] flex-col rounded-t-3xl border border-line bg-surface shadow-2xl"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{heading}</h2>
            <p className="text-xs text-muted">
              {tiles.length === 1 ? t("{n} jogo", { n: tiles.length }) : t("{n} jogos", { n: tiles.length })}
              {platform && ` · ${platform}`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("Fechar")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-lg text-muted"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4">

          {players.length > 1 && (
            <div className="flex gap-2 text-sm" role="tablist" aria-label={t("Jogador")}>
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
            <p className="py-6 text-center text-sm text-muted">{t("Nenhum jogo nesta categoria por enquanto.")}</p>
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
                          category === "platinas" || (typeof category === "object" && title.earned.platinum > 0)
                            ? "text-platinum"
                            : "text-muted"
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
              {showAll ? t("Mostrar menos") : t("Ver todos os {n}", { n: tiles.length })}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
