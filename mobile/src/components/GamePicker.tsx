import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app";
import { browseCatalog, buildBoostCatalog, catalogPlatforms, myGames, type BoostCandidate } from "../lib/boost";
import { catalogProgress, loadCatalog, useCatalog, type CatalogLoaders } from "../lib/gameCatalog";
import { t } from "../i18n";
import { useSettings } from "../lib/settings";
import { ALL_ID } from "../lib/store";
import { groupTrophies } from "../lib/stats";
import { useData } from "../lib/useData";
import { demoStoreCategory, storeCategory } from "../psn/store";
import type { TrophyRow } from "../psn/types";
import { PlayStationLogo } from "./icons";
import { GameIcon, rarityLabel, RemoteImage, Spinner, TrophyBadge } from "./ui";

const PAGE = 30;

/** Loaders do catálogo (seus jogos, amigos e loja) para o modo atual. */
function useCatalogLoaders(): { key: string; loaders: () => CatalogLoaders } {
  const { client, mode } = useApp();
  const { storeRegion } = useSettings();
  return {
    key: `${mode}:${storeRegion}`,
    loaders: () => ({
      mine: () => client.titles("me"),
      friendIds: () => client.friendIds(),
      // Lista completa de jogos de cada amigo (não só os recentes).
      friendTitles: (id) => client.titles(id).catch(() => client.recentTitles(id)),
      store: (onProgress) =>
        mode === "demo" ? demoStoreCategory(ALL_ID) : storeCategory(ALL_ID, storeRegion, false, onProgress),
    }),
  };
}

/** Começa a carregar o catálogo em segundo plano (ao abrir as Atividades). */
export function usePrefetchGameCatalog() {
  const { key, loaders } = useCatalogLoaders();
  useEffect(() => {
    const timer = setTimeout(() => loadCatalog(key, loaders()), 1500);
    return () => clearTimeout(timer);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Catálogo de jogos para escolher (Boost e Desafios): seus jogos, os jogos de
 * todos os amigos (com lista de troféus da PSN) e a PlayStation Store inteira.
 */
export function useGameCatalog() {
  const { key, loaders } = useCatalogLoaders();
  const state = useCatalog(key, loaders);
  const all = useMemo(
    () => buildBoostCatalog(state.mine ?? [], state.friends, state.store),
    [state.mine, state.friends, state.store],
  );
  const mine = useMemo(() => myGames(state.mine ?? [], all), [state.mine, all]);
  return { all, mine, state, progress: catalogProgress(state) };
}

/**
 * Escolha do jogo: todo o catálogo ou só os seus jogos, por plataforma, em
 * ordem alfabética (rolando aparecem mais) e com busca por nome.
 * `onlyWithTrophies` mostra só jogos com lista de troféus na PSN.
 */
export function GamePicker({
  onPick,
  onlyWithTrophies = false,
}: {
  onPick: (game: BoostCandidate) => void;
  onlyWithTrophies?: boolean;
}) {
  const catalog = useGameCatalog();
  const { state } = catalog;
  const [platform, setPlatform] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"todos" | "meus">("todos");
  const [shown, setShown] = useState(PAGE);
  const usable = useMemo(() => {
    const base = source === "meus" ? catalog.mine : catalog.all;
    return onlyWithTrophies ? base.filter((c) => c.title) : base;
  }, [catalog.all, catalog.mine, onlyWithTrophies, source]);
  const platforms = catalogPlatforms(usable);
  const list = useMemo(() => browseCatalog(usable, platform, query), [usable, platform, query]);
  useEffect(() => setShown(PAGE), [platform, query, source]);

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

  // "Só os meus jogos" fica pronto assim que a sua lista chega; o catálogo
  // completo espera amigos e loja, com o progresso na tela.
  const ready = source === "meus" ? !!state.mine : state.done;
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-sm ${active ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1 text-xs" role="radiogroup" aria-label={t("Origem dos jogos")}>
        {(
          [
            ["todos", <PlayStationLogo key="i" size={16} />, t("Todo o catálogo")],
            ["meus", <span key="i" aria-hidden>🎮</span>, t("Só os meus jogos")],
          ] as const
        ).map(([k, icon, label]) => (
          <button
            key={k}
            role="radio"
            aria-checked={source === k}
            onClick={() => setSource(k)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-semibold ${
              source === k ? "bg-ps-blue" : "text-muted"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {!ready ? (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <PlayStationLogo size={18} />
            {source === "meus" ? t("Carregando seus jogos…") : t("Carregando o catálogo PlayStation…")}
          </p>
          {source === "todos" && (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-ps-blue-2 transition-[width] duration-500"
                  style={{ width: `${Math.max(4, catalog.progress)}%` }}
                />
              </div>
              <ul className="space-y-0.5 text-[0.6875rem] text-muted">
                <li>
                  {state.mine
                    ? t("✔ Seus jogos: {n}", { n: state.mine.length })
                    : t("… Seus jogos")}
                </li>
                <li>
                  {state.friendsTotal === null
                    ? t("… Jogos dos amigos")
                    : t("Jogos dos amigos: {done} de {total} amigos", {
                        done: state.friendsDone,
                        total: state.friendsTotal,
                      })}
                </li>
                <li>
                  {state.storeTotal
                    ? t("PlayStation Store: {n} de {total} jogos", { n: state.storeLoaded, total: state.storeTotal })
                    : state.storeLoaded
                      ? t("PlayStation Store: {n} jogos", { n: state.storeLoaded })
                      : t("… PlayStation Store")}
                </li>
              </ul>
              <p className="text-[0.6875rem] text-muted">
                {t("Na primeira vez pode demorar um pouco; depois o catálogo fica guardado por 30 minutos.")}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label={t("Plataforma do jogo")}>
            {[null, ...platforms].map((p) => (
              <button
                key={p ?? "todas"}
                onClick={() => setPlatform(p)}
                className={chip(platform === p)}
                aria-pressed={platform === p}
              >
                {p ?? t("Todas")}
              </button>
            ))}
          </nav>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={source === "meus" ? t("Buscar nos seus jogos") : t("Buscar em todo o catálogo PlayStation")}
            className="w-full rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
          />
          <p className="text-[0.6875rem] text-muted">
            {platform
              ? t("{n} jogos de {platform}", { n: list.length, platform })
              : t("{n} jogos", { n: list.length })}
            {" · "}
            {t("ordem alfabética")}
          </p>
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
                        g.myProgress !== null ? t("seu: {p}%", { p: g.myProgress }) : null,
                        g.friends
                          ? g.friends === 1
                            ? t("{n} amigo tem", { n: g.friends })
                            : t("{n} amigos têm", { n: g.friends })
                          : null,
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
          {list.length === 0 && <p className="text-sm text-muted">{t("Nenhum jogo encontrado.")}</p>}
        </>
      )}
    </div>
  );
}

/** Lista de troféus do jogo escolhido (seus, quando você tem o jogo), com os grupos (jogo base e DLCs). */
export function useTrophyList(game: BoostCandidate | null) {
  const { client } = useApp();
  return useData(
    async () => {
      if (!game?.title) return null;
      const [trophies, groups] = await Promise.all([
        game.myProgress !== null ? client.gameTrophies("me", game.title) : client.titleTrophies(game.title),
        game.title.hasGroups ? client.trophyGroups(game.title).catch(() => []) : Promise.resolve([]),
      ]);
      return { trophies, groups };
    },
    [client, game?.key],
  );
}

/**
 * Lista de troféus para escolher, separada como no perfil: jogo base e cada
 * DLC em sua própria lista, que abre e fecha. Mostra ícone, tipo, descrição e
 * raridade. `earned`: "hide" esconde os que você já tem (pedido de boost),
 * "show" mostra todos (ajudar alguém) e "toggle" deixa escolher.
 * `multiple` permite marcar vários; senão, um só.
 */
export function TrophyPicker({
  game,
  selected,
  onChange,
  multiple = true,
  earned = "toggle",
}: {
  game: BoostCandidate;
  selected: number[];
  onChange: (ids: number[], rows: TrophyRow[]) => void;
  multiple?: boolean;
  earned?: "hide" | "show" | "toggle";
}) {
  const trophies = useTrophyList(game);
  const [showEarned, setShowEarned] = useState(earned === "show");
  const [type, setType] = useState<string>("todos");
  const [open, setOpen] = useState<Set<string>>(new Set(["default"]));

  if (!game.title)
    return (
      <p className="text-sm text-muted">
        {t("A PSN só mostra a lista de troféus de jogos que você ou algum amigo já jogou.")}
      </p>
    );
  if (trophies.loading && !trophies.data) return <Spinner label={t("Carregando a lista de troféus…")} />;
  if (!trophies.data) return <p className="text-sm text-muted">{t("Não foi possível carregar a lista de troféus.")}</p>;

  const all = trophies.data.trophies;
  const earnedCount = all.filter((tr) => tr.earned).length;
  const visible = (tr: TrophyRow) =>
    (earned === "show" || (earned === "toggle" && showEarned) || !tr.earned) && (type === "todos" || tr.type === type);
  const sections = groupTrophies(all, trophies.data.groups)
    .map((sec) => ({ ...sec, rows: sec.trophies.filter(visible) }))
    .filter((sec) => sec.rows.length > 0);
  const toggle = (tr: TrophyRow) => {
    const ids = selected.includes(tr.id)
      ? selected.filter((id) => id !== tr.id)
      : multiple
        ? [...selected, tr.id]
        : [tr.id];
    onChange(ids, all.filter((r) => ids.includes(r.id)));
  };
  const toggleSection = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-2.5 py-1 text-xs ${active ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;

  if (earned === "hide" && all.length > 0 && earnedCount === all.length)
    return <p className="text-sm text-muted">{t("Você já tem todos os troféus deste jogo.")}</p>;

  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
        {(
          [
            ["todos", t("Todos")],
            ["platinum", t("Platina")],
            ["gold", t("Ouro")],
            ["silver", t("Prata")],
            ["bronze", t("Bronze")],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setType(k)} className={chip(type === k)} aria-pressed={type === k}>
            {label}
          </button>
        ))}
      </div>
      {earned === "toggle" && earnedCount > 0 && (
        <label className="flex items-center justify-between text-xs text-muted">
          <span>{t("Mostrar os {n} que você já tem", { n: earnedCount })}</span>
          <input
            type="checkbox"
            checked={showEarned}
            onChange={(e) => setShowEarned(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-ps-blue)]"
          />
        </label>
      )}
      {earned === "hide" && earnedCount > 0 && (
        <p className="text-[0.6875rem] text-muted">
          {t("Os {n} troféus que você já tem ficam de fora.", { n: earnedCount })}
        </p>
      )}

      <div className="space-y-2" aria-label={t("Troféus")}>
        {sections.map((sec) => {
          const expanded = open.has(sec.group.id) || sections.length === 1;
          const picked = sec.rows.filter((r) => selected.includes(r.id)).length;
          return (
            <section key={sec.group.id} className="overflow-hidden rounded-xl border border-line">
              <button
                onClick={() => toggleSection(sec.group.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 bg-surface-2 px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {sec.isBase ? t("Jogo base") : sec.group.name}
                  </span>
                  <span className="text-[0.6875rem] text-muted">
                    {sec.isBase ? "" : `${t("DLC")} · `}
                    {sec.rows.length === 1
                      ? t("{n} troféu", { n: sec.rows.length })
                      : t("{n} troféus", { n: sec.rows.length })}
                    {picked > 0 && ` · ${t("{n} escolhidos", { n: picked })}`}
                  </span>
                </span>
                <span className="text-muted" aria-hidden>
                  {expanded ? "▴" : "▾"}
                </span>
              </button>
              {expanded && (
                <ul className="space-y-1.5 p-2">
                  {sec.rows.map((tr) => {
                    const on = selected.includes(tr.id);
                    return (
                      <li key={tr.id}>
                        <button
                          onClick={() => toggle(tr)}
                          aria-pressed={on}
                          className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${
                            on ? "border-ps-blue-2 bg-surface-2" : "border-line"
                          } ${tr.earned ? "opacity-70" : ""}`}
                        >
                          <RemoteImage
                            src={tr.iconUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg"
                            fallback={
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                                🏆
                              </span>
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold">{tr.name}</span>
                              <TrophyBadge type={tr.type} />
                            </span>
                            {tr.detail && <span className="line-clamp-2 text-[0.6875rem] text-muted">{tr.detail}</span>}
                            <span className="text-[0.625rem] text-ps-blue-2">
                              {[tr.earned ? t("✔ você já tem") : null, rarityLabel(tr.rate)].filter(Boolean).join(" · ")}
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
                </ul>
              )}
            </section>
          );
        })}
        {sections.length === 0 && <p className="text-sm text-muted">{t("Nenhum troféu aqui.")}</p>}
      </div>
    </div>
  );
}
