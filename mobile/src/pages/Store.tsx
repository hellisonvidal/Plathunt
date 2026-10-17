import { useMemo, useState } from "react";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { ErrorBox, RemoteImage, Spinner } from "../components/ui";
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

/** Quantos jogos aparecem antes do "ver mais". */
const PAGE = 40;
const DEFAULT_FILTERS: StoreFilters = { query: "", platform: "todas", onlyDiscount: false, price: "todas", sort: "relevancia" };

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
  const catalog = useData(
    async (force) => {
      const products = await load(categoryId, force, (list, total) => setPartial({ key, products: list, total }));
      recordPrices(products, region);
      return { key, products };
    },
    [mode, categoryId, region],
  );
  const current = catalog.data?.key === key ? catalog.data.products : null;
  const streaming = !current && partial?.key === key ? partial : null;
  const products = current ?? streaming?.products ?? null;

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
            {!products && !catalog.error && <Spinner label="Buscando o catálogo da PlayStation Store…" />}
            {streaming && (
              <div className="rounded-xl border border-line bg-surface p-3 text-xs text-muted">
                <p>
                  Carregando a loja… {streaming.products.length.toLocaleString("pt-BR")}
                  {streaming.total > 0 && ` de ${streaming.total.toLocaleString("pt-BR")}`} jogos
                </p>
                {streaming.total > 0 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-ps-blue-2"
                      style={{ width: `${Math.min(100, (streaming.products.length / streaming.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {products && (
              <ProductGrid
                key={`${categoryId}:${JSON.stringify(filters)}`}
                products={filterProducts(products, filters)}
                total={products.length}
                region={region}
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
    (filters.platform !== "todas" ? 1 : 0) + (filters.onlyDiscount ? 1 : 0) + (filters.price !== "todas" ? 1 : 0);

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
}: {
  products: StoreProduct[];
  total: number;
  region: StoreRegion;
}) {
  const [shown, setShown] = useState(PAGE);
  if (!products.length) {
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
      <p className="text-xs text-muted">
        {products.length.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} jogos
      </p>
      <ul className="grid grid-cols-2 gap-3">
        {products.slice(0, shown).map((p) => (
          <li key={p.id}>
            <ProductCard product={p} region={region} />
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

function ProductCard({ product: p, region }: { product: StoreProduct; region: StoreRegion }) {
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
}
