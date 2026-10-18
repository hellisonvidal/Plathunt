import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app";
import { FilterIcon, PsPlusIcon } from "../components/icons";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, RemoteImage } from "../components/ui";
import { locale, t } from "../i18n";
import { useSettings } from "../lib/settings";
import {
  filterCounts,
  filterProducts,
  formatPrice,
  isNewLow,
  kindOf,
  priceRangeKey,
  priceRanges,
  selectedKinds,
  selectedPlatforms,
  selectedPrices,
  priceHistory,
  recordPrices,
  PLUS_ID,
  STORE_CATEGORIES,
  STORE_KINDS,
  STORE_SORTS,
  storeProductUrl,
  type StoreFilters,
  type StoreKind,
  type StorePlatform,
  type StoreProduct,
  type StoreRegion,
} from "../lib/store";
import { useData } from "../lib/useData";
import { openInBrowser } from "../psn/native";
import { demoStoreCategory, storeCacheKey, storeCategory, type StoreProgress } from "../psn/store";
import { peekCached } from "../lib/cache";

/** Quantos jogos entram na tela de cada vez (mais aparecem sozinhos ao rolar). */
const PAGE = 40;
const DEFAULT_FILTERS: StoreFilters = {
  query: "",
  platform: [],
  onlyDiscount: false,
  hidePlus: false,
  hideFree: false,
  price: [],
  sort: "relevancia",
  kind: [],
};
/** Intervalo mínimo entre atualizações da lista enquanto a loja carrega (evita a tela piscar). */
const STREAM_THROTTLE_MS = 700;

/**
 * Loja: catálogo da PlayStation Store (ofertas, PS5, PS4, grátis, PS Plus)
 * com busca, filtros e ordenação.
 */
export function StorePage() {
  const { mode } = useApp();
  const { storeRegion: region } = useSettings();
  const [categoryId, setCategoryId] = useState<string>(STORE_CATEGORIES[0].id);
  const [filters, setFilters] = useState<StoreFilters>(DEFAULT_FILTERS);

  const load = (id: string, force: boolean, onProgress?: StoreProgress) =>
    mode === "demo" ? demoStoreCategory(id) : storeCategory(id, region, force, onProgress);

  // A loja tem milhares de jogos por categoria: eles aparecem enquanto as
  // páginas chegam, com o progresso no topo.
  const key = `${mode}:${region}:${categoryId}`;
  const [partial, setPartial] = useState<{ key: string; products: StoreProduct[]; total: number } | null>(null);
  const lastPartial = useRef(0);
  const catalog = useData(
    async (force) => {
      lastPartial.current = 0;
      const products = await load(categoryId, force, (list, total) => {
        // Atualiza a tela no máximo a cada STREAM_THROTTLE_MS: a lista cresce sem piscar.
        const now = Date.now();
        if (lastPartial.current && now - lastPartial.current < STREAM_THROTTLE_MS) return;
        lastPartial.current = now;
        setPartial({ key, products: list, total });
      });
      recordPrices(products, region);
      return { key, products };
    },
    [mode, categoryId, region],
  );
  // A lista salva no celular aparece na hora, mesmo vencida, enquanto a nova chega.
  const [saved, setSaved] = useState<{ key: string; products: StoreProduct[] } | null>(null);
  useEffect(() => {
    if (mode === "demo") return;
    let alive = true;
    void peekCached<StoreProduct[]>(storeCacheKey(region, categoryId)).then((hit) => {
      if (alive && hit && Array.isArray(hit.value)) setSaved({ key, products: hit.value });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = catalog.data?.key === key ? catalog.data.products : null;
  const stale = !current && saved?.key === key ? saved.products : null;
  const streaming = !current && !stale && partial?.key === key ? partial : null;
  const products = current ?? stale ?? streaming?.products ?? null;
  // Filtrar milhares de jogos fica em segundo plano: digitar e rolar seguem fluidos.
  const deferredFilters = useDeferredValue(filters);
  const deferredProducts = useDeferredValue(products);
  const visible = useMemo(
    () => (deferredProducts ? filterProducts(deferredProducts, deferredFilters) : null),
    [deferredProducts, deferredFilters],
  );

  return (
    <>
      <PageHeader title={t("Loja")} onRefresh={catalog.refresh} refreshing={catalog.loading} />
      <div className="space-y-4 px-4 pt-4">
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 text-sm" aria-label={t("Categoria")}>
            {STORE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 ${
                  categoryId === c.id ? "bg-ps-blue font-semibold" : "border border-line text-muted"
                }`}
              >
                {c.id === PLUS_ID ? (
                  <span className="inline-flex items-center gap-1" aria-label="PS Plus">
                    <PsPlusIcon size={16} /> Plus
                  </span>
                ) : (
                  t(c.label)
                )}
              </button>
            ))}
          </nav>

        <FilterBar filters={filters} onChange={setFilters} region={region} products={deferredProducts} />
        {catalog.error ? <ErrorBox error={catalog.error} onRetry={catalog.refresh} /> : null}

        {/* Linha de status com altura fixa: o progresso não empurra a lista. */}
        <div className="min-h-9 space-y-1.5" aria-live="polite">
          <p className="text-xs text-muted">
            {!products
              ? t("Buscando o catálogo da PlayStation Store…")
              : streaming
                ? streaming.total > 0
                  ? t("Carregando a loja… {n} de {total} jogos", { n: streaming.products.length, total: streaming.total })
                  : t("Carregando a loja… {n} jogos", { n: streaming.products.length })
                : t("{n} de {total} jogos", { n: visible?.length ?? 0, total: products.length })}
            {stale && catalog.loading && t(" · atualizando a lista salva…")}
          </p>
          {(!current || catalog.loading) && !catalog.error && (
            <div className="h-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full bg-ps-blue-2 transition-[width] duration-700 ease-out ${
                  streaming?.total ? "" : "w-1/3 animate-pulse"
                }`}
                style={streaming?.total ? { width: `${Math.min(100, (streaming.products.length / streaming.total) * 100)}%` } : undefined}
              />
            </div>
          )}
        </div>

        {!products && !catalog.error && <SkeletonGrid />}
        {visible && (
          <ProductGrid
            key={`${categoryId}:${JSON.stringify(deferredFilters)}`}
            products={visible}
            total={products?.length ?? 0}
            region={region}
            loading={!current}
          />
        )}

        <p className="pb-2 text-center text-[0.6875rem] text-muted">
          {t(
            "Preços da PlayStation Store ({region}). O menor preço é o menor que o app já viu neste celular; a loja não informa preços antigos.",
            { region },
          )}
        </p>
      </div>
    </>
  );
}

function FilterBar({
  filters,
  onChange,
  region,
  products,
}: {
  filters: StoreFilters;
  onChange: (f: StoreFilters) => void;
  region: StoreRegion;
  /** Jogos carregados, para contar quantos cada opção mostra. */
  products: StoreProduct[] | null;
}) {
  const [open, setOpen] = useState(false);
  // Faixas de preço em chips (sem "Qualquer": nenhuma escolhida = qualquer preço).
  const chipRanges = priceRanges(region).filter((r) => r.key !== "todas");
  const chipKeys = new Set(chipRanges.map((r) => r.key));
  // Contagem de cada opção (só com o painel aberto): opções vazias somem.
  const counts = useMemo(
    () => (open && products ? filterCounts(products, filters, region) : null),
    [open, products, filters, region],
  );
  const set = (patch: Partial<StoreFilters>) => onChange({ ...filters, ...patch });
  const active =
    selectedPlatforms(filters).length +
    (filters.onlyDiscount ? 1 : 0) +
    (filters.hidePlus ? 1 : 0) +
    (filters.hideFree ? 1 : 0) +
    selectedPrices(filters).length +
    selectedKinds(filters).length;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder={t("Buscar jogo")}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
        />
        <select
          value={filters.sort}
          onChange={(e) => set({ sort: e.target.value as StoreFilters["sort"] })}
          aria-label={t("Ordenar")}
          className="w-[36%] min-w-0 rounded-full border border-line bg-surface-2 px-2 text-sm"
        >
          {STORE_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.label)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={active > 0 ? t("Filtros ({n} ativos)", { n: active }) : t("Filtros")}
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
            open || active > 0 ? "border-ps-blue-2 text-ps-blue-2" : "border-line text-muted"
          } bg-surface-2`}
        >
          <FilterIcon />
          {active > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ps-blue px-1 text-[0.625rem] font-bold">
              {active}
            </span>
          )}
        </button>
      </div>
      {open && (
        <div className="space-y-3 rounded-xl border border-line bg-surface p-3 text-sm">
          {/* Várias opções ao mesmo tempo; tocar de novo numa opção escolhida tira ela (sem nenhuma = todas). */}
          <Chips
            counts={counts?.platform}
            label={t("Plataforma")}
            allOption={["todas", t("Todas")]}
            options={[
              ["PS5", "PS5"],
              ["PS4", "PS4"],
            ]}
            selected={selectedPlatforms(filters)}
            onChange={(list) => set({ platform: list as StorePlatform[] })}
          />
          <Chips
            counts={counts?.kind}
            label={t("Tipo")}
            allOption={["todos", t("Todos")]}
            options={STORE_KINDS.map((k) => [k.value, t(k.label)] as const)}
            selected={selectedKinds(filters)}
            onChange={(list) => set({ kind: list as StoreKind[] })}
          />
          <Chips
            counts={counts?.price}
            label={t("Preço")}
            options={chipRanges.map((r) => [r.key, r.label] as const)}
            selected={(Array.isArray(filters.price) ? filters.price : [filters.price]).map(priceRangeKey).filter((k) => chipKeys.has(k))}
            // Escolher faixas prontas apaga a faixa digitada.
            onChange={(keys) => set({ price: chipRanges.filter((r) => keys.includes(r.key)).map((r) => r.range), customPrice: null })}
          />
          <CustomPrice
            value={filters.customPrice ?? null}
            // Digitar uma faixa tira as faixas prontas escolhidas.
            onChange={(customPrice) => set({ customPrice, price: [] })}
          />
          <label className="flex items-center justify-between">
            <span>{t("Só jogos com desconto")}</span>
            <input
              type="checkbox"
              checked={filters.onlyDiscount}
              onChange={(e) => set({ onlyDiscount: e.target.checked })}
              className="h-5 w-5 accent-[var(--color-ps-blue)]"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>{t("Esconder jogos grátis")}</span>
            <input
              type="checkbox"
              checked={filters.hideFree}
              onChange={(e) => set({ hideFree: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-[var(--color-ps-blue)]"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="inline-flex items-center gap-1.5">
                {t("Esconder jogos da")} <PsPlusIcon size={18} />
              </span>
              <span className="block text-xs text-muted">{t("Mostra só o que não depende da assinatura")}</span>
            </span>
            <input
              type="checkbox"
              checked={filters.hidePlus}
              onChange={(e) => set({ hidePlus: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-[var(--color-ps-blue)]"
            />
          </label>
          {active > 0 && (
            <button onClick={() => onChange({ ...DEFAULT_FILTERS, query: filters.query, sort: filters.sort })} className="text-ps-blue-2 underline">
              {t("Limpar filtros")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Faixa de preço livre: mínimo e máximo digitados (na moeda da região). */
function CustomPrice({
  value,
  onChange,
}: {
  value: { min: number | null; max: number | null } | null;
  onChange: (range: { min: number | null; max: number | null } | null) => void;
}) {
  const toText = (cents: number | null | undefined) => (cents ? String(Math.round(cents / 100)) : "");
  const [min, setMin] = useState(toText(value?.min && value.min > 1 ? value.min - 1 : null));
  const [max, setMax] = useState(toText(value?.max));
  // Quando a faixa digitada some por fora (chip de preço ou "Limpar filtros"), os campos esvaziam.
  const emitted = useRef(value);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setMin(toText(value?.min && value.min > 1 ? value.min - 1 : null));
    setMax(toText(value?.max));
  }, [value]);
  const apply = (lo: string, hi: string) => {
    const a = Number(lo.replace(",", "."));
    const b = Number(hi.replace(",", "."));
    const minC = lo && Number.isFinite(a) ? Math.round(a * 100) : null;
    const maxC = hi && Number.isFinite(b) ? Math.round(b * 100) : null;
    const next = minC === null && maxC === null ? null : { min: (minC ?? 0) + 1, max: maxC };
    emitted.current = next;
    onChange(next);
  };
  const input = "w-full min-w-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-ps-blue-2";
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">{t("Ou digite a faixa")}</p>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={min}
          onChange={(e) => {
            setMin(e.target.value);
            apply(e.target.value, max);
          }}
          placeholder={t("Mínimo")}
          aria-label={t("Preço mínimo")}
          className={input}
        />
        <span className="text-muted">–</span>
        <input
          inputMode="decimal"
          value={max}
          onChange={(e) => {
            setMax(e.target.value);
            apply(min, e.target.value);
          }}
          placeholder={t("Máximo")}
          aria-label={t("Preço máximo")}
          className={input}
        />
      </div>
    </div>
  );
}

function Chips({
  label,
  options,
  selected,
  onChange,
  counts,
  allOption,
}: {
  label: string;
  options: (readonly [string, string])[];
  /** Opções escolhidas (várias ao mesmo tempo; vazia = todas). */
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Quantos jogos cada opção mostra: a contagem aparece e as opções vazias somem (menos as escolhidas). */
  counts?: Record<string, number>;
  /** Opção "Todas": fica marcada sem nenhuma escolha e, ao tocar, limpa o filtro. */
  allOption?: readonly [string, string];
}) {
  const shown = counts ? options.filter(([v]) => selected.includes(v) || (counts[v] ?? 0) > 0) : options;
  const chip = (on: boolean) => `rounded-full px-3 py-1 ${on ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;
  const count = (v: string) =>
    counts && <span className="ml-1 tabular-nums opacity-70">{(counts[v] ?? 0).toLocaleString(locale())}</span>;
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {allOption && (
          <button aria-pressed={selected.length === 0} onClick={() => onChange([])} className={chip(selected.length === 0)}>
            {allOption[1]}
            {count(allOption[0])}
          </button>
        )}
        {shown.map(([v, l]) => {
          const on = selected.includes(v);
          return (
            <button
              key={v}
              aria-pressed={on}
              onClick={() => onChange(on ? selected.filter((x) => x !== v) : [...selected, v])}
              className={chip(on)}
            >
              {l}
              {count(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProductGrid({
  products,
  total,
  region,
  loading,
}: {
  products: StoreProduct[];
  total: number;
  region: StoreRegion;
  loading: boolean;
}) {
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = products.length > shown;

  // Rolagem infinita: ao chegar perto do fim, entram mais jogos sozinhos.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    if (typeof IntersectionObserver === "undefined") return setShown(products.length);
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE);
    }, { rootMargin: "800px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [more, products.length, shown]);

  if (!products.length) {
    if (loading) return <SkeletonGrid />;
    return (
      <p className="py-10 text-center text-sm text-muted">
        {total === 0
          ? t("A PlayStation Store não trouxe jogos nesta categoria agora. Puxe a tela para baixo para tentar de novo.")
          : t("Nenhum jogo encontrado com esses filtros.")}
      </p>
    );
  }
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products.slice(0, shown).map((p) => (
          <li key={p.id}>
            <ProductCard product={p} region={region} />
          </li>
        ))}
      </ul>
      {more && (
        <div ref={sentinel} aria-hidden>
          <SkeletonGrid count={2} />
        </div>
      )}
    </>
  );
}

/** Cartões "fantasma" no formato dos jogos enquanto a loja carrega. */
function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="aspect-square w-full animate-pulse bg-surface-2" />
          <div className="space-y-2 p-2.5">
            <div className="h-3 w-4/5 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Preço atual, preço cheio riscado e o menor preço já visto. */
function PriceInfo({ product: p, region }: { product: StoreProduct; region: StoreRegion }) {
  const history = useMemo(() => priceHistory(region, p.id), [region, p.id, p.price]);
  const lowestSeen = history && p.price !== null && history.min < p.price;
  const atLowest = p.price !== null && p.price > 0 && isNewLow(history, p.price);
  // Frase inteira traduzida; o preço em destaque entra no lugar de "{price}".
  const lowestParts = lowestSeen
    ? t("Menor já visto: {price} em {date}", { date: new Date(history.minAt).toLocaleDateString(locale()) }).split("{price}")
    : [];
  return (
    // Fica no pé do cartão: os preços de uma mesma linha da grade ficam alinhados.
    <div className="mt-auto pt-1">
      {lowestSeen && (
        <p className="text-[0.6875rem] leading-tight text-muted">
          {lowestParts[0]}
          <strong className="text-ink">{formatPrice(history.min, region)}</strong>
          {lowestParts[1]}
        </p>
      )}
      {atLowest && <p className="text-[0.6875rem] font-semibold leading-tight text-ps-blue-2">{t("🔥 Menor preço já visto pelo app")}</p>}
      <div className="flex items-baseline gap-x-1.5 overflow-hidden whitespace-nowrap">
        <span className="shrink-0 text-sm font-bold">{p.isFree ? t("Grátis") : (p.priceText ?? "—")}</span>
        {p.discount > 0 && p.basePriceText && (
          <span className="truncate text-[0.6875rem] text-muted line-through">{p.basePriceText}</span>
        )}
      </div>
    </div>
  );
}

/** Cartão memorizado: enquanto a loja carrega, só os jogos novos são desenhados. */
const ProductCard = memo(function ProductCard({ product: p, region }: { product: StoreProduct; region: StoreRegion }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <a
      href={storeProductUrl(p.id, region)}
      target="_blank"
      rel="noreferrer"
      // Sempre na página do jogo escolhido (no navegador), nunca na tela inicial do app da PlayStation.
      onClick={(e) => {
        e.preventDefault();
        void openInBrowser(storeProductUrl(p.id, region));
      }}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="relative bg-surface-2">
        <RemoteImage
          src={p.imageUrl}
          alt=""
          onLoad={() => setLoaded(true)}
          className={`aspect-square w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          fallback={
            <span className="flex aspect-square w-full items-center justify-center bg-surface-2 text-4xl" aria-hidden>
              🎮
            </span>
          }
        />
        {p.discount > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-ps-blue px-2 py-0.5 text-xs font-bold">-{p.discount}%</span>
        )}
        {p.plus && (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 shadow">
            <PsPlusIcon size={18} />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="line-clamp-2 text-xs font-semibold leading-snug">{p.name}</p>
        <p className="mt-0.5 flex items-center gap-1 overflow-hidden whitespace-nowrap text-[0.625rem] text-muted">
          {/* Tipo do produto: jogo completo, demo, avaliação, DLC... */}
          <span
            className={`shrink-0 rounded px-1 py-px font-semibold ${
              kindOf(p) === "jogo" ? "bg-surface-2 text-muted" : "bg-ps-blue-2/10 text-ps-blue-2"
            }`}
          >
            {t(STORE_KINDS.find((k) => k.value === kindOf(p))!.label)}
          </span>
          <span className="truncate">{p.platforms.join(" · ")}</span>
        </p>
        <PriceInfo product={p} region={region} />
      </div>
    </a>
  );
});
