import { useMemo, useState } from "react";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, RemoteImage, Spinner } from "../components/ui";
import { useSettings } from "../lib/settings";
import {
  filterProducts,
  formatPrice,
  isNewLow,
  priceHistory,
  recordPrices,
  refreshWishlist,
  STORE_CATEGORIES,
  STORE_SORTS,
  storeProductUrl,
  toggleWish,
  useWishlist,
  type StoreFilters,
  type StoreProduct,
  type StoreRegion,
} from "../lib/store";
import { useData } from "../lib/useData";
import { demoStoreCategory, storeCategory } from "../psn/store";

/** Quantos jogos aparecem antes do "ver mais". */
const PAGE = 40;
/** Faixas de preço do filtro, na moeda da loja (em unidades, não centavos). */
const PRICE_CAPS = [null, 50, 100, 200] as const;

const DEFAULT_FILTERS: StoreFilters = { query: "", platform: "todas", onlyDiscount: false, maxPrice: null, sort: "relevancia" };

/**
 * Loja: catálogo da PlayStation Store (ofertas, PS5, PS4, grátis, PS Plus)
 * com busca, filtros e ordenação, e a lista de desejos salva no celular.
 */
export function StorePage() {
  const { mode } = useApp();
  const { storeRegion: region } = useSettings();
  const [view, setView] = useState<"catalogo" | "desejos">("catalogo");
  const [categoryId, setCategoryId] = useState<string>(STORE_CATEGORIES[0].id);
  const [filters, setFilters] = useState<StoreFilters>(DEFAULT_FILTERS);
  const wishlist = useWishlist();

  const load = (id: string, force: boolean) => (mode === "demo" ? demoStoreCategory(id) : storeCategory(id, region, force));

  const catalog = useData(
    async (force) => {
      const products = await load(categoryId, force);
      recordPrices(products, region);
      refreshWishlist(products, region);
      return products;
    },
    [mode, categoryId, region],
  );

  // Ao abrir a lista de desejos, atualiza os preços com as categorias principais.
  const wishRefresh = useData(
    async (force) => {
      if (view !== "desejos") return null;
      const lists = await Promise.all(
        STORE_CATEGORIES.slice(0, 3).map((c) => load(c.id, force).catch(() => [] as StoreProduct[])),
      );
      const all = lists.flat();
      recordPrices(all, region);
      refreshWishlist(all, region);
      return all.length;
    },
    [mode, region, view],
  );

  const refresh = view === "desejos" ? wishRefresh : catalog;

  return (
    <>
      <PageHeader title="Loja" onRefresh={refresh.refresh} refreshing={refresh.loading} />
      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1 text-sm" role="tablist">
          {(
            [
              ["catalogo", "🛒 Catálogo"],
              ["desejos", `♥ Desejos${wishlist.length ? ` (${wishlist.length})` : ""}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`rounded-xl py-2 font-semibold ${view === key ? "bg-ps-blue" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "catalogo" && (
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
        )}

        <FilterBar filters={filters} onChange={setFilters} region={region} />

        {view === "catalogo" ? (
          <>
            {catalog.error ? <ErrorBox error={catalog.error} onRetry={catalog.refresh} /> : null}
            {catalog.loading && !catalog.data && <Spinner label="Buscando o catálogo da PlayStation Store…" />}
            {catalog.data && (
              <ProductGrid
                key={`${categoryId}:${JSON.stringify(filters)}`}
                products={filterProducts(catalog.data, filters)}
                total={catalog.data.length}
                region={region}
                wished={new Set(wishlist.filter((w) => w.region === region).map((w) => w.product.id))}
              />
            )}
          </>
        ) : (
          <Wishlist filters={filters} region={region} />
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
    (filters.platform !== "todas" ? 1 : 0) + (filters.onlyDiscount ? 1 : 0) + (filters.maxPrice !== null ? 1 : 0);

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
          className="max-w-[45%] rounded-full border border-line bg-surface-2 px-3 text-sm"
        >
          {STORE_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-sm"
      >
        <span>
          Filtros{active > 0 && <span className="ml-1.5 rounded-full bg-ps-blue px-1.5 text-xs">{active}</span>}
        </span>
        <span className="text-muted">{open ? "▴" : "▾"}</span>
      </button>
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
            options={PRICE_CAPS.map((cap) => [String(cap), cap === null ? "Qualquer" : `até ${formatPrice(cap * 100, region)}`])}
            value={String(filters.maxPrice === null ? null : filters.maxPrice / 100)}
            onChange={(v) => set({ maxPrice: v === "null" ? null : Number(v) * 100 })}
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
  wished,
}: {
  products: StoreProduct[];
  total: number;
  region: StoreRegion;
  wished: Set<string>;
}) {
  const [shown, setShown] = useState(PAGE);
  if (!products.length) {
    return <p className="py-10 text-center text-sm text-muted">Nenhum jogo encontrado com esses filtros.</p>;
  }
  return (
    <>
      <p className="text-xs text-muted">
        {products.length.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} jogos
      </p>
      <ul className="grid grid-cols-2 gap-3">
        {products.slice(0, shown).map((p) => (
          <li key={p.id}>
            <ProductCard product={p} region={region} wished={wished.has(p.id)} />
          </li>
        ))}
      </ul>
      {products.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className="w-full rounded-xl border border-line py-2.5 text-sm font-semibold text-ps-blue-2"
        >
          Ver mais ({products.length - shown})
        </button>
      )}
    </>
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

function WishButton({ product, region, wished }: { product: StoreProduct; region: StoreRegion; wished: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        toggleWish(product, region);
      }}
      aria-pressed={wished}
      aria-label={wished ? "Tirar da lista de desejos" : "Adicionar à lista de desejos"}
      className={`flex h-8 w-8 items-center justify-center rounded-full text-base shadow ${
        wished ? "bg-ps-blue" : "bg-surface/90 text-muted"
      }`}
    >
      {wished ? "♥" : "♡"}
    </button>
  );
}

function ProductCard({ product: p, region, wished }: { product: StoreProduct; region: StoreRegion; wished: boolean }) {
  return (
    <a
      href={storeProductUrl(p.id, region)}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="relative">
        <RemoteImage
          src={p.imageUrl}
          alt=""
          className="aspect-square w-full object-cover"
          fallback={
            <span className="flex aspect-square w-full items-center justify-center bg-surface-2 text-4xl" aria-hidden>
              🎮
            </span>
          }
        />
        {p.discount > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-ps-blue px-2 py-0.5 text-xs font-bold">-{p.discount}%</span>
        )}
        <span className="absolute right-2 top-2">
          <WishButton product={p} region={region} wished={wished} />
        </span>
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-xs font-semibold leading-snug">{p.name}</p>
        <p className="mt-0.5 text-[0.625rem] text-muted">{p.platforms.join(" · ")}</p>
        <PriceInfo product={p} region={region} />
      </div>
    </a>
  );
}

function Wishlist({ filters, region }: { filters: StoreFilters; region: StoreRegion }) {
  const wishlist = useWishlist();
  const mine = wishlist.filter((w) => w.region === region);
  const products = filterProducts(
    mine.map((w) => w.product),
    filters,
  );
  if (!mine.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
        <p className="text-3xl">♡</p>
        <p className="mt-2">Sua lista de desejos está vazia.</p>
        <p className="mt-1">Toque no ♡ de um jogo no Catálogo para acompanhar o preço dele aqui.</p>
      </div>
    );
  }
  const onSale = mine.filter((w) => w.product.discount > 0).length;
  return (
    <>
      <p className="text-xs text-muted">
        {mine.length} {mine.length === 1 ? "jogo" : "jogos"} na lista
        {onSale > 0 && ` · ${onSale} em promoção`}
      </p>
      {products.length ? (
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id}>
              <a
                href={storeProductUrl(p.id, region)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5"
              >
                <div className="relative shrink-0">
                  <RemoteImage
                    src={p.imageUrl}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover"
                    fallback={
                      <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2 text-2xl" aria-hidden>
                        🎮
                      </span>
                    }
                  />
                  {p.discount > 0 && (
                    <span className="absolute -left-1 -top-1 rounded-full bg-ps-blue px-1.5 text-[0.625rem] font-bold">
                      -{p.discount}%
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <PriceInfo product={p} region={region} />
                </div>
                <WishButton product={p} region={region} wished />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted">Nenhum jogo da lista com esses filtros.</p>
      )}
    </>
  );
}
