import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app";
import { browseCatalog, buildBoostCatalog, catalogPlatforms, type BoostCandidate } from "../lib/boost";
import { mapLimit } from "../lib/cache";
import { useSettings } from "../lib/settings";
import { ALL_ID } from "../lib/store";
import { useData } from "../lib/useData";
import { demoStoreCategory, storeCategory } from "../psn/store";
import type { Title, TrophyRow } from "../psn/types";
import { GameIcon, rarityLabel, RemoteImage, Spinner, TrophyBadge } from "./ui";

const PAGE = 30;

/**
 * Catálogo de jogos para escolher (Boost e Desafios): seus jogos, os jogos de
 * todos os amigos (com lista de troféus da PSN) e a PlayStation Store inteira.
 */
export function useGameCatalog() {
  const { client, mode } = useApp();
  const { storeRegion } = useSettings();
  const titles = useData((force) => client.titles("me", force), [client]);
  const extra = useData(
    async (force) => {
      const [friendsTitles, store] = await Promise.all([
        client
          .friendIds(force)
          .then((ids) => mapLimit(ids, 5, (id) => client.recentTitles(id, force).catch(() => [] as Title[])))
          .catch(() => [] as Title[][]),
        (mode === "demo" ? demoStoreCategory(ALL_ID) : storeCategory(ALL_ID, storeRegion, force)).catch(() => []),
      ]);
      return { friendsTitles, store };
    },
    [client, mode, storeRegion],
  );
  const all = useMemo(
    () => buildBoostCatalog(titles.data ?? [], extra.data?.friendsTitles ?? [], extra.data?.store ?? []),
    [titles.data, extra.data],
  );
  return { all, ready: !!titles.data, loadingMore: extra.loading && !extra.data, error: titles.error, retry: titles.refresh };
}

/**
 * Escolha do jogo: abas por plataforma com todos os jogos disponíveis (rolando
 * aparecem mais) e busca por nome. `onlyWithTrophies` mostra só jogos com
 * lista de troféus na PSN (necessário nos Desafios).
 */
export function GamePicker({
  onPick,
  onlyWithTrophies = false,
}: {
  onPick: (game: BoostCandidate) => void;
  onlyWithTrophies?: boolean;
}) {
  const catalog = useGameCatalog();
  const [platform, setPlatform] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const usable = useMemo(
    () => (onlyWithTrophies ? catalog.all.filter((c) => c.title) : catalog.all),
    [catalog.all, onlyWithTrophies],
  );
  const platforms = catalogPlatforms(usable);
  const list = useMemo(() => browseCatalog(usable, platform, query), [usable, platform, query]);
  useEffect(() => setShown(PAGE), [platform, query]);

  const sentinel = useRef<HTMLLIElement>(null);
  const more = list.length > shown;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    if (typeof IntersectionObserver === "undefined") return setShown(list.length);
    const obs = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setShown((n) => n + PAGE), {
      rootMargin: "400px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [more, list.length, shown]);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-sm ${active ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;

  return (
    <div className="space-y-2">
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Plataforma do jogo">
        {[null, ...platforms].map((p) => (
          <button key={p ?? "todas"} onClick={() => setPlatform(p)} className={chip(platform === p)} aria-pressed={platform === p}>
            {p ?? "Todas"}
          </button>
        ))}
      </nav>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar em todo o catálogo PlayStation"
        className="w-full rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
      />
      {!catalog.ready && <Spinner label="Carregando seus jogos…" />}
      {catalog.ready && (
        <p className="text-[0.6875rem] text-muted">
          {list.length.toLocaleString("pt-BR")} jogos{platform ? ` de ${platform}` : ""}
          {catalog.loadingMore && " · carregando jogos dos amigos e da PlayStation Store…"}
        </p>
      )}
      <ul className="space-y-1.5">
        {list.slice(0, shown).map((g) => (
          <li key={g.key}>
            <button
              onClick={() => onPick(g)}
              className="flex w-full items-center gap-3 rounded-xl border border-line p-2 text-left active:border-muted"
            >
              <GameIcon src={g.iconUrl} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{g.name}</span>
                <span className="block truncate text-[0.6875rem] text-muted">
                  {[
                    g.platforms.join(" · "),
                    g.myProgress !== null ? `seu: ${g.myProgress}%` : null,
                    g.friends ? `${g.friends} ${g.friends === 1 ? "amigo tem" : "amigos têm"}` : null,
                    g.myProgress === null && !g.friends && g.inStore ? "PlayStation Store" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="text-muted" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
        {more && <li ref={sentinel} className="h-8" aria-hidden />}
      </ul>
      {catalog.ready && list.length === 0 && !catalog.loadingMore && (
        <p className="text-sm text-muted">Nenhum jogo encontrado.</p>
      )}
    </div>
  );
}

/** Lista de troféus do jogo escolhido (seus, quando você tem o jogo). */
export function useTrophyList(game: BoostCandidate | null) {
  const { client } = useApp();
  return useData(
    async () => {
      if (!game?.title) return null;
      return game.myProgress !== null ? client.gameTrophies("me", game.title) : client.titleTrophies(game.title);
    },
    [client, game?.key],
  );
}

/**
 * Lista completa de troféus para escolher: ícone, tipo, descrição e raridade.
 * `multiple` permite marcar vários; senão, um só.
 */
export function TrophyPicker({
  game,
  selected,
  onChange,
  multiple = true,
}: {
  game: BoostCandidate;
  selected: number[];
  onChange: (ids: number[], rows: TrophyRow[]) => void;
  multiple?: boolean;
}) {
  const trophies = useTrophyList(game);
  const [showEarned, setShowEarned] = useState(false);
  const [type, setType] = useState<string>("todos");

  if (!game.title)
    return (
      <p className="text-sm text-muted">
        A PSN só mostra a lista de troféus de jogos que você ou algum amigo já jogou.
      </p>
    );
  if (trophies.loading && !trophies.data) return <Spinner label="Carregando a lista de troféus…" />;
  if (!trophies.data) return <p className="text-sm text-muted">Não foi possível carregar a lista de troféus.</p>;

  const earnedCount = trophies.data.filter((t) => t.earned).length;
  const list = trophies.data.filter((t) => (showEarned || !t.earned) && (type === "todos" || t.type === type));
  const toggle = (t: TrophyRow) => {
    const ids = selected.includes(t.id)
      ? selected.filter((id) => id !== t.id)
      : multiple
        ? [...selected, t.id]
        : [t.id];
    onChange(ids, trophies.data!.filter((r) => ids.includes(r.id)));
  };
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-2.5 py-1 text-xs ${active ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;

  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
        {(
          [
            ["todos", "Todos"],
            ["platinum", "Platina"],
            ["gold", "Ouro"],
            ["silver", "Prata"],
            ["bronze", "Bronze"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setType(k)} className={chip(type === k)} aria-pressed={type === k}>
            {label}
          </button>
        ))}
      </div>
      {earnedCount > 0 && (
        <label className="flex items-center justify-between text-xs text-muted">
          <span>Mostrar os {earnedCount} que você já tem</span>
          <input
            type="checkbox"
            checked={showEarned}
            onChange={(e) => setShowEarned(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-ps-blue)]"
          />
        </label>
      )}
      <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1" aria-label="Troféus">
        {list.map((t) => {
          const on = selected.includes(t.id);
          return (
            <li key={t.id}>
              <button
                onClick={() => toggle(t)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${
                  on ? "border-ps-blue-2 bg-surface-2" : "border-line"
                } ${t.earned ? "opacity-70" : ""}`}
              >
                <RemoteImage src={t.iconUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg" fallback={
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">🏆</span>
                } />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{t.name}</span>
                    <TrophyBadge type={t.type} />
                  </span>
                  {t.detail && <span className="line-clamp-2 text-[0.6875rem] text-muted">{t.detail}</span>}
                  <span className="text-[0.625rem] text-ps-blue-2">
                    {[t.earned ? "✔ você já tem" : null, rarityLabel(t.rate)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                    on ? "border-ps-blue-2 bg-ps-blue font-bold" : "border-line"
                  }`}
                  aria-hidden
                >
                  {on ? "✓" : ""}
                </span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="text-sm text-muted">Nenhum troféu aqui.</li>}
      </ul>
    </div>
  );
}
