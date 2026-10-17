import { useEffect, useState } from "react";
import { locale, t } from "../i18n";
import { persistSet } from "./persist";
import { parsePlatforms, PLATFORM_ORDER } from "./stats";
import type { Title } from "../psn/types";

/**
 * Convocação de boost: o jogador escolhe um jogo e chama gente para fazer
 * junto os troféus online (ou de cooperativo). A PSN não deixa outros apps
 * mandarem mensagens, então a convocação vira um texto pronto para enviar
 * no WhatsApp, Telegram, Discord ou nas mensagens da PSN, e fica salva aqui.
 */

export const BOOST_WHEN = ["Agora", "Hoje à noite", "Amanhã", "Fim de semana", "A combinar"] as const;

export interface Boost {
  id: string;
  game: { id: string; name: string; platform: string; iconUrl: string | null };
  /** Quantos jogadores faltam. */
  players: number;
  when: string;
  /** Troféus que precisam de boost (nomes). */
  trophies: string[];
  note: string;
  createdAt: string;
  /** Amigos (onlineId) que já toparam. */
  joined: string[];
  done: boolean;
  /**
   * "pedido": você precisa de ajuda (só troféus que faltam). "ajuda": você
   * responde a uma convocação e oferece ajuda num jogo que já fez.
   */
  kind?: "pedido" | "ajuda";
}

const KEY = "tm.boosts" as const;
const listeners = new Set<() => void>();

export function getBoosts(): Boost[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((b): b is Boost => !!b && typeof b === "object" && typeof b.id === "string" && !!b.game?.name)
      : [];
  } catch {
    return [];
  }
}

function save(list: Boost[]) {
  persistSet(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export function addBoost(b: Omit<Boost, "id" | "createdAt" | "joined" | "done" | "kind"> & { kind?: Boost["kind"] }, now = new Date()): Boost {
  const boost: Boost = { ...b, id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: now.toISOString(), joined: [], done: false };
  save([boost, ...getBoosts()]);
  return boost;
}

export function updateBoost(id: string, patch: Partial<Pick<Boost, "joined" | "done">>) {
  save(getBoosts().map((b) => (b.id === id ? { ...b, ...patch } : b)));
}

export function removeBoost(id: string) {
  save(getBoosts().filter((b) => b.id !== id));
}

export function useBoosts(): Boost[] {
  const [list, setList] = useState(getBoosts);
  useEffect(() => {
    const sync = () => setList(getBoosts());
    listeners.add(sync);
    return () => void listeners.delete(sync);
  }, []);
  return list;
}

/** Texto da convocação, pronto para colar em qualquer conversa. */
export function boostMessage(
  b: Pick<Boost, "game" | "players" | "when" | "trophies" | "note" | "kind">,
  me: string,
): string {
  if (b.kind === "ajuda") {
    const help = [
      t("🤝 Posso ajudar no boost: {game} ({platform})", { game: b.game.name, platform: b.game.platform }),
      t("🕒 {when}", { when: t(b.when) }),
    ];
    if (b.trophies.length) help.push(t("🏆 Troféus: {list}", { list: b.trophies.join(", ") }));
    if (b.note.trim()) help.push(`📝 ${b.note.trim()}`);
    help.push(t("🎮 Me chama na PSN: {me}", { me }));
    return help.join("\n");
  }
  const lines = [
    t("📣 BOOST: {game} ({platform})", { game: b.game.name, platform: b.game.platform }),
    b.players === 1
      ? t("👥 Procuro {n} jogador · 🕒 {when}", { n: b.players, when: t(b.when) })
      : t("👥 Procuro {n} jogadores · 🕒 {when}", { n: b.players, when: t(b.when) }),
  ];
  if (b.trophies.length) lines.push(t("🏆 Troféus: {list}", { list: b.trophies.join(", ") }));
  if (b.note.trim()) lines.push(`📝 ${b.note.trim()}`);
  lines.push(t("🎮 Me chama na PSN: {me}", { me }));
  return lines.join("\n");
}

/** Nome comparável entre versões (PS4/PS5, ™, maiúsculas). */
export const normalizeGameName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[™®©]/g, "")
    .replace(/\b(ps4|ps5|playstation ?[45]|edition|edicao)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** O jogo do amigo é o mesmo da convocação (mesmo id ou mesmo nome em outra plataforma). */
export function sameGame(a: Pick<Title, "id" | "name">, b: Pick<Title, "id" | "name">): boolean {
  return a.id === b.id || normalizeGameName(a.name) === normalizeGameName(b.name);
}

/** Links para enviar o texto da convocação. */
export function shareLinks(text: string) {
  const t = encodeURIComponent(text);
  return {
    whatsapp: `https://wa.me/?text=${t}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent("https://www.playstation.com")}&text=${t}`,
  };
}

/** Jogo que pode ser escolhido na convocação (seu, de amigos ou da PlayStation Store). */
export interface BoostCandidate {
  key: string;
  name: string;
  platform: string;
  /** Plataformas em que o jogo existe ("PS5", "PS4", "PS3", "PS Vita"…). */
  platforms: string[];
  iconUrl: string | null;
  /** Lista de troféus na PSN (quando você ou um amigo jogou). */
  title: Title | null;
  /** Seu progresso, se você tem o jogo. */
  myProgress: number | null;
  /** Quantos amigos têm o jogo. */
  friends: number;
  inStore: boolean;
}

/**
 * Junta todos os jogos conhecidos: os seus, os dos amigos (todos com lista de
 * troféus da PSN) e o catálogo da PlayStation Store. O mesmo jogo aparece uma
 * vez só, com a lista de troféus quando alguém já jogou.
 */
export function buildBoostCatalog(
  mine: Title[],
  friendsTitles: Title[][],
  store: { name: string; platforms: string[]; imageUrl: string | null }[],
): BoostCandidate[] {
  const byName = new Map<string, BoostCandidate>();
  const add = (name: string, make: () => BoostCandidate, update: (c: BoostCandidate) => void) => {
    const key = normalizeGameName(name);
    if (!key) return;
    const found = byName.get(key);
    if (found) update(found);
    else byName.set(key, make());
  };
  const join = (c: BoostCandidate, more: string[]) => {
    c.platforms = [...new Set([...c.platforms, ...more])];
  };
  for (const t of mine)
    add(
      t.name,
      () => ({ key: normalizeGameName(t.name), name: t.name, platform: t.platform, platforms: parsePlatforms(t.platform), iconUrl: t.iconUrl, title: t, myProgress: t.progress, friends: 0, inStore: false }),
      (c) => join(c, parsePlatforms(t.platform)),
    );
  for (const list of friendsTitles) {
    const seen = new Set<string>();
    for (const t of list) {
      const key = normalizeGameName(t.name);
      if (seen.has(key)) continue;
      seen.add(key);
      add(
        t.name,
        () => ({ key, name: t.name, platform: t.platform, platforms: parsePlatforms(t.platform), iconUrl: t.iconUrl, title: t, myProgress: null, friends: 1, inStore: false }),
        (c) => {
          join(c, parsePlatforms(t.platform));
          c.friends += 1;
          c.title ??= t;
        },
      );
    }
  }
  for (const p of store)
    add(
      p.name,
      () => ({
        key: normalizeGameName(p.name),
        name: p.name,
        platform: p.platforms.join("/") || "PS5",
        platforms: p.platforms.length ? [...p.platforms] : ["PS5"],
        iconUrl: p.imageUrl,
        title: null,
        myProgress: null,
        friends: 0,
        inStore: true,
      }),
      (c) => {
        join(c, p.platforms);
        c.inStore = true;
        c.iconUrl ??= p.imageUrl;
      },
    );
  return [...byName.values()];
}

/** Busca por nome: primeiro os seus jogos, depois os mais jogados pelos amigos, depois a loja. */
export function searchBoostCatalog(catalog: BoostCandidate[], query: string, limit = 20): BoostCandidate[] {
  if (!normalizeGameName(query)) return [];
  return browseCatalog(catalog, null, query).slice(0, limit);
}

/**
 * Lista para navegar: os jogos de uma plataforma (ou de todas, com `null`),
 * filtrados pela busca, em ordem alfabética.
 */
export function browseCatalog(catalog: BoostCandidate[], platform: string | null, query = ""): BoostCandidate[] {
  const q = normalizeGameName(query);
  const collator = new Intl.Collator(locale(), { sensitivity: "base", numeric: true });
  return catalog
    .filter((c) => (!platform || c.platforms.includes(platform)) && (!q || c.key.includes(q)))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * Só os seus jogos: um item por jogo da sua lista de troféus (as versões de
 * PS4 e PS5 aparecem separadas, como no perfil), com o total de amigos que
 * também têm o jogo, vindo do catálogo completo.
 */
export function myGames(mine: Title[], catalog: BoostCandidate[]): BoostCandidate[] {
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  return mine.map((title) => {
    const known = byKey.get(normalizeGameName(title.name));
    return {
      key: `me:${title.id}`,
      name: title.name,
      platform: title.platform,
      platforms: parsePlatforms(title.platform),
      iconUrl: title.iconUrl,
      title,
      myProgress: title.progress,
      friends: known?.friends ?? 0,
      inStore: known?.inStore ?? false,
    };
  });
}

/** Origem dos jogos no seletor: todos, só os seus, os dos amigos ou os da loja. */
export type CatalogSource = "todos" | "meus" | "amigos" | "loja";

export function bySource(catalog: BoostCandidate[], source: CatalogSource): BoostCandidate[] {
  if (source === "meus") return catalog.filter((c) => c.myProgress !== null);
  if (source === "amigos") return catalog.filter((c) => c.friends > 0);
  if (source === "loja") return catalog.filter((c) => c.inStore);
  return catalog;
}

/** Plataformas presentes no catálogo, na ordem PS5, PS4, PS3, PS Vita. */
export function catalogPlatforms(catalog: BoostCandidate[]): string[] {
  const all = new Set(catalog.flatMap((c) => c.platforms));
  return PLATFORM_ORDER.filter((p) => all.has(p));
}
