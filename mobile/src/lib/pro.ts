import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect, useState } from "react";
import { persistSet } from "./persist";
import { isPlayStoreBuild } from "../psn/native";

/**
 * Plathunt Pro: compra única pela Play Store (Google Play Billing) que libera
 * a loja avançada (menor preço), os temas de jogos, o mural das Estatísticas
 * e várias contas da PSN no mesmo celular.
 *
 * Só bloqueia na versão da Play Store e só depois que o produto existe e está
 * ativo na Play Console: antes disso, no APK do GitHub, no navegador e na
 * demonstração, tudo continua liberado.
 */

/** Id do produto na Play Console (Monetizar → Produtos no app → Produtos únicos). */
export const PRO_PRODUCT_ID = "plathunt_pro";

export type ProFeature = "lojaAvancada" | "temas" | "mural" | "contas";

/** Benefícios mostrados na tela "Plathunt Pro" (textos são chaves de tradução). */
export const PRO_FEATURES: { key: ProFeature; icon: string; label: string; hint: string }[] = [
  { key: "lojaAvancada", icon: "📉", label: "Loja avançada", hint: "Selo e filtro de menor preço e o menor preço já visto de cada jogo" },
  { key: "temas", icon: "🎨", label: "Temas de jogos", hint: "Todos os temas inspirados em jogos famosos" },
  { key: "mural", icon: "🖼️", label: "Mural das Estatísticas", hint: "As capas dos jogos de cada estatística, suas e do amigo" },
  { key: "contas", icon: "👥", label: "Várias contas da PSN", hint: "Adicione outras contas e troque entre elas com um toque" },
];

export interface ProState {
  /** O produto existe e está ativo na Play Store. */
  available: boolean;
  /** Comprado nesta conta do Google. */
  owned: boolean;
  /** Pagamento em análise (ex.: boleto). */
  pending?: boolean;
  /** Preço já formatado pela loja ("R$ 19,90"). */
  price?: string;
}

const KEY = "tm.pro";
const EMPTY: ProState = { available: false, owned: false };

/** Regra do bloqueio: só na Play Store, com o produto à venda e ainda não comprado. */
export function isLocked(state: ProState, playStoreBuild: boolean): boolean {
  return playStoreBuild && state.available && !state.owned;
}

function read(): ProState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<ProState>;
      return { available: !!s.available, owned: !!s.owned, pending: !!s.pending, price: s.price };
    }
  } catch {}
  return EMPTY;
}

let state: ProState = read();
const listeners = new Set<() => void>();

function save(next: ProState) {
  state = next;
  persistSet(KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

export const getPro = (): ProState => state;
export const proLocked = (): boolean => isLocked(state, isPlayStoreBuild());

/** Avisa quando a compra ou o produto mudam (ex.: o tema volta a valer depois da compra). */
export function onProChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Plugin nativo da versão da Play Store (android/app/src/play/.../PlayBillingPlugin.java). */
interface PlayBillingPlugin {
  status(options: { productId: string }): Promise<{ available: boolean; owned: boolean; pending: boolean; price?: string }>;
  buy(options: { productId: string }): Promise<{ owned: boolean; pending: boolean; cancelled: boolean }>;
  addListener(
    event: "purchase",
    fn: (r: { owned: boolean; pending: boolean; cancelled: boolean }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const PlayBilling = registerPlugin<PlayBillingPlugin>("PlayBilling");
const billingReady = () => isPlayStoreBuild() && Capacitor.isPluginAvailable("PlayBilling");

/**
 * Pergunta à Play Store se o Pro está à venda e se já foi comprado. Sem
 * resposta (sem internet), fica o último estado salvo: quem comprou continua
 * com tudo liberado offline.
 */
export async function refreshPro(): Promise<ProState> {
  if (!billingReady()) return state;
  try {
    const r = await PlayBilling.status({ productId: PRO_PRODUCT_ID });
    // Uma compra já vista não se perde por uma resposta incompleta da loja.
    save({ available: r.available, owned: r.owned || (state.owned && !r.available), pending: r.pending, price: r.price ?? state.price });
  } catch {}
  return state;
}

export type BuyResult = "comprado" | "pendente" | "cancelado" | "indisponivel";

/** Abre a compra do Google Play. */
export async function buyPro(): Promise<BuyResult> {
  if (!billingReady()) return "indisponivel";
  const r = await PlayBilling.buy({ productId: PRO_PRODUCT_ID });
  if (r.owned) {
    save({ ...state, available: true, owned: true, pending: false });
    return "comprado";
  }
  if (r.pending) {
    save({ ...state, pending: true });
    return "pendente";
  }
  return "cancelado";
}

/** Ao abrir o app: confere a compra e acompanha pagamentos que terminam depois (ex.: pendentes). */
export function initPro() {
  // Relê depois de restaurar a cópia nativa (o módulo carregou antes dela).
  state = read();
  if (!billingReady()) return;
  void refreshPro();
  void PlayBilling.addListener("purchase", (r) => {
    if (r.owned) save({ ...state, available: true, owned: true, pending: false });
  }).catch(() => {});
}

/** Estado do Pro na tela (atualiza ao comprar). */
export function usePro(): ProState & { locked: boolean } {
  const [, setTick] = useState(0);
  useEffect(() => onProChange(() => setTick((n) => n + 1)), []);
  return { ...state, locked: proLocked() };
}
