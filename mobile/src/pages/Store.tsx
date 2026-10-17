import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app";
import { FilterIcon } from "../components/icons";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, RemoteImage } from "../components/ui";
import { useSettings } from "../lib/settings";
import {
  filterProducts,
  formatPrice,
  isNewLow,
  priceRangeKey,
  priceRanges,
  priceHistory,
  recordPrices,
  STORE_CATEGORIES,
  STORE_SORTS,
  storeProductUrl,
  type StoreFilters,
  type StoreProduct,
  type StoreRegion,
} from "../lib/store";
import { useData } from "../lib/useData";
import { demoStoreCategory, storeCategory, type StoreProgress } from "../psn/store";

/** Quantos jogos entram na tela de cada vez (mais aparecem sozinhos ao rolar). */
const PAGE = 40;
const DEFAULT_FILTERS: StoreFilters = {
  query: "",
  platform: "todas",
  onlyDiscount: false,
  hidePlus: false,
  price: "todas",
  sort: "relevancia",
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
  const current = catalog.data?.key === key ? catalog.data.products : null;
  const streaming = !current && partial?.key === key ? partial : null;
  const products = current ?? streaming?.products ?? null;
  // Filtrar milhares de jogos fica em segundo plano: digitar e rolar seguem fluidos.
  const deferredFilters = useDeferredValue(filters);
  const deferredProducts = useDeferredValue(products);
  const visible = useMemo(
    () => (deferredProducts ? filterProducts(deferredProducts, deferredFilters) : null),
    [deferredProducts, deferredFilters],
  );

  return (
    <>
      <PageHeader title="Loja" onRefresh={catalog.refresh} refreshing={catalog.loading} />
      <div className="space-y-4 px-4 pt-4">
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 text-sm" aria-label="Categoria">
            {STORE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 ${
                  categoryId === c.id ? "bg-ps-blue font-semibold" : "border border-line text-muted"
                }`}
              >
                {c.label}
              </button>
            ))}
          </nav>

        <FilterBar filters={filters} onChange={setFilters} region={region} />
        {catalog.error ? <ErrorBox error={catalog.error} onRetry={catalog.refresh} /> : null}

        {/* Linha de status com altura fixa: o progresso não empurra a lista. */}
        <div className="min-h-9 space-y-1.5" aria-live="polite">
          <p className="text-xs text-muted">
            {!products
              ? "Buscando o catálogo da PlayStation Store…"
              : streaming
                ? `Carregando a loja… ${streaming.products.length.toLocaleString("pt-BR")}${
                    streaming.total > 0 ? ` de ${streaming.total.toLocaleString("pt-BR")}` : ""
                  } jogos`
                : `${(visible?.length ?? 0).toLocaleString("pt-BR")} de ${products.length.toLocaleString("pt-BR")} jogos`}
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
          Preços da PlayStation Store ({region}). O menor preço é o menor que o app já viu neste celular; a loja não
          informa preços antigos.
        </p>
      </div>
    </>
  );
}

function FilterBar({
  filters,
  onChange,
  region,
}: {
  filters: StoreFilters;
  onChange: (f: StoreFilters) => void;
  region: StoreRegion;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<StoreFilters>) => onChange({ ...filters, ...patch });
  const active =
    (filters.platform !== "todas" ? 1 : 0) +
    (filters.onlyDiscount ? 1 : 0) +
    (filters.hidePlus ? 1 : 0) +
    (filters.price !== "todas" ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Buscar jogo"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
        />
        <select
          value={filters.sort}
          onChange={(e) => set({ sort: e.target.value as StoreFilters["sort"] })}
          aria-label="Ordenar"
          className="w-[36%] min-w-0 rounded-full border border-line bg-surface-2 px-2 text-sm"
        >
          {STORE_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={active > 0 ? `Filtros (${active} ativos)` : "Filtros"}
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
          <Chips
            label="Plataforma"
            options={[
              ["todas", "Todas"],
              ["PS5", "PS5"],
              ["PS4", "PS4"],
            ]}
            value={filters.platform}
            onChange={(platform) => set({ platform: platform as StoreFilters["platform"] })}
          />
          <Chips
            label="Preço"
            options={priceRanges(region).map((r) => [r.key, r.label] as const)}
            value={priceRangeKey(filters.price)}
            onChange={(k) => set({ price: priceRanges(region).find((r) => r.key === k)?.range ?? "todas" })}
          />
          <label className="flex items-center justify-between">
            <span>Só jogos com desconto</span>
            <input
              type="checkbox"
              checked={filters.onlyDiscount}
              onChange={(e) => set({ onlyDiscount: e.target.checked })}
              className="h-5 w-5 accent-[var(--color-ps-blue)]"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>
              Esconder jogos da PS Plus
              <span className="block text-xs text-muted">Mostra só o que não depende da assinatura</span>
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
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: (readonly [string, string])[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`rounded-full px-3 py-1 ${value === v ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`}
          >
            {l}
          </button>
        ))}
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
          ? "A PlayStation Store não trouxe jogos nesta categoria agora. Puxe a tela para baixo para tentar de novo."
          : "Nenhum jogo encontrado com esses filtros."}
      </p>
    );
  }
  return (
    <>
      <ul className="grid grid-cols-2 gap-3">
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
    <ul className="grid grid-cols-2 gap-3" aria-hidden>
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
  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-sm font-bold">{p.isFree ? "Grátis" : (p.priceText ?? "—")}</span>
        {p.discount > 0 && p.basePriceText && <span className="text-[0.6875rem] text-muted line-through">{p.basePriceText}</span>}
      </div>
      {lowestSeen && (
        <p className="text-[0.6875rem] text-muted">
          Menor já visto: <strong className="text-ink">{formatPrice(history.min, region)}</strong> em{" "}
          {new Date(history.minAt).toLocaleDateString("pt-BR")}
        </p>
      )}
      {atLowest && <p className="text-[0.6875rem] font-semibold text-ps-blue-2">🔥 Menor preço já visto pelo app</p>}
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
      className="block overflow-hidden rounded-2xl border border-line bg-surface"
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
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[0.625rem] font-bold text-black">
            PS Plus
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-xs font-semibold leading-snug">{p.name}</p>
        <p className="mt-0.5 text-[0.625rem] text-muted">{p.platforms.join(" · ")}</p>
        <PriceInfo product={p} region={region} />
      </div>
    </a>
  );
});
