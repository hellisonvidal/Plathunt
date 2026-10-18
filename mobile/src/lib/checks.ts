import { t } from "../i18n";
import type { PsnClient } from "../psn/types";
import { sameGame } from "./boost";
import { mapLimit } from "./cache";
import {
  challengeStats,
  findTrophy,
  getChallenges,
  isFinished,
  rankChallenge,
  saveResults,
  type Challenge,
  type PlayerResult,
} from "./challenges";
import { evaluateMerits, meritName } from "./merits";
import { getMeritDates, recordMeritDates } from "./meritDates";
import { notificationsEnabled, notify } from "./notify";
import { countReactedItems } from "./reactions";
import { BUILD_NUMBER, getSettings } from "./settings";
import { matchPlayed } from "./stats";
import { checkForUpdate } from "./updates";
import { isPlayStoreBuild } from "../psn/native";
import { syncCloudInbox } from "./boostInbox";
import { cloudIdentity, likesOnMine } from "./cloud";

/** Posições de um desafio agora, pelas datas de conquista na PSN de cada jogador. */
export async function rankChallengeNow(client: PsnClient, c: Challenge, force = false): Promise<Record<string, PlayerResult>> {
  const game = { id: c.game.titleId, name: c.game.name };
  const raw = Object.fromEntries(
    await mapLimit(c.players, 3, async (p) => {
      const titles = await client.titles(p.accountId, force).catch(() => null);
      if (!titles) return [p.accountId, "privado"] as const;
      const title = titles.find((x) => x.id === game.id) ?? titles.find((x) => sameGame(x, game));
      if (!title) return [p.accountId, "sem-jogo"] as const;
      const trophies = await client.gameTrophies(p.accountId, title, force).catch(() => null);
      if (!trophies) return [p.accountId, "privado"] as const;
      const row = findTrophy(trophies, c.trophy, title.id === game.id);
      return [p.accountId, { earnedAt: row?.earned ? row.earnedAt : null }] as const;
    }),
  );
  const results = rankChallenge(c, raw);
  if (JSON.stringify(results) !== JSON.stringify(c.results)) saveResults(c.id, results);
  return results;
}

/** Estado das verificações (quando rodou, até onde já avisou). */
interface CheckState {
  at: number;
  feedSince: string | null;
  updateNotified: number | null;
  likesSince: string | null;
}
const KEY = "tm.checks";
/** Intervalo mínimo entre verificações (para não gastar chamadas à PSN). */
const EVERY_MS = 15 * 60_000;
let running = false;

function readState(): CheckState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      at: Number(s.at) || 0,
      feedSince: s.feedSince ?? null,
      updateNotified: s.updateNotified ?? null,
      likesSince: s.likesSince ?? null,
    };
  } catch {
    return { at: 0, feedSince: null, updateNotified: null, likesSince: null };
  }
}

function writeState(s: CheckState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

/**
 * Roda ao abrir o app e ao voltar para ele (no máximo a cada 15 min) e avisa:
 * novos méritos, desafios vencidos, platinas dos amigos e nova versão do app.
 */
export async function runBackgroundChecks(client: PsnClient, now = Date.now()): Promise<void> {
  const settings = getSettings();
  if (!settings.notifications || running) return;
  const state = readState();
  if (now - state.at < EVERY_MS) return;
  running = true;
  try {
    state.at = now;
    writeState(state);

    if (notificationsEnabled("challenges", settings)) await checkChallenges(client);
    if (notificationsEnabled("merits", settings)) await checkMerits(client);
    if (notificationsEnabled("friends", settings)) state.feedSince = await checkFriends(client, state.feedSince, now);
    if (notificationsEnabled("updates", settings)) state.updateNotified = await checkUpdate(state.updateNotified);
    if (notificationsEnabled("social", settings)) state.likesSince = await checkSocial(state.likesSince, now);
    writeState(state);
  } finally {
    running = false;
  }
}

async function checkChallenges(client: PsnClient) {
  for (const c of getChallenges().filter((x) => !isFinished(x))) {
    const before = c.results;
    const after = await rankChallengeNow(client, c).catch(() => null);
    if (!after) continue;
    const winner = c.players.find((p) => after[p.accountId]?.status === "venceu");
    if (winner && before[winner.accountId]?.status !== "venceu") {
      await notify(
        "challenges",
        `challenge-win:${c.id}`,
        winner.accountId === "me" ? t("🏆 Você venceu o desafio!") : t("🏁 {name} venceu o desafio", { name: winner.onlineId }),
        t("{trophy} · {game}", { trophy: c.trophy.name, game: c.game.name }),
      );
    }
  }
}

async function checkMerits(client: PsnClient) {
  const [profile, titles, played, friendIds] = await Promise.all([
    client.me(),
    client.titles("me"),
    client.playedGames("me"),
    client.friendIds().catch(() => null),
  ]);
  const play = matchPlayed(titles, played ?? []);
  const results = evaluateMerits({
    profile,
    titles,
    playtime: new Map([...play].map(([id, p]) => [id, p.seconds])),
    playedOn: new Map([...play].map(([id, p]) => [id, p.platform])),
    friends: friendIds ? friendIds.length : null,
    reactions: countReactedItems(),
    challenges: challengeStats(getChallenges()),
    now: Date.now(),
  });
  const known = getMeritDates(profile.accountId);
  const firstTime = Object.keys(known).length === 0;
  const done = results.filter((r) => r.done);
  recordMeritDates(profile.accountId, done.map((r) => r.merit.id));
  if (firstTime) return;
  const fresh = done.filter((r) => !known[r.merit.id]);
  if (fresh.length === 1) {
    await notify("merits", `merit:${fresh[0].merit.id}`, t("🏅 Novo mérito!"), meritName(fresh[0].merit));
  } else if (fresh.length > 1) {
    await notify(
      "merits",
      `merits:${Date.now()}`,
      t("🏅 {n} novos méritos!", { n: fresh.length }),
      fresh.slice(0, 3).map((r) => meritName(r.merit)).join(" · "),
    );
  }
}

async function checkFriends(client: PsnClient, since: string | null, now: number): Promise<string> {
  const stamp = new Date(now).toISOString();
  // Na primeira vez só marca o ponto de partida (sem avisar platinas antigas).
  if (!since) return stamp;
  const feed = await client.feed().catch(() => []);
  const plats = feed.filter((i) => !i.owner.isMe && i.trophy.type === "platinum" && i.earnedAt > since).slice(0, 3);
  // O próximo ponto de partida é a conquista mais recente que chegou de fato
  // (a lista pode estar até meia hora atrasada; sem resposta, fica onde estava).
  const newest = feed.reduce((max, i) => (i.earnedAt > max ? i.earnedAt : max), since);
  for (const item of plats) {
    await notify(
      "friends",
      `plat:${item.key}`,
      t("🏆 {name} platinou!", { name: item.owner.onlineId }),
      item.game.name,
      undefined,
      `/game/${item.owner.accountId}/${item.game.id}?service=${item.game.service}`,
    );
  }
  return newest;
}

/** Recursos online: curtidas nas suas conquistas e pedidos de boost que chegaram. */
async function checkSocial(since: string | null, now: number): Promise<string | null> {
  if (!(await cloudIdentity())) return since;
  const stamp = new Date(now).toISOString();
  const requests = await syncCloudInbox().catch(() => []);
  for (const r of requests.slice(0, 3)) {
    await notify(
      "social",
      `boost-req:${r.id}`,
      t("📥 Pedido de boost de {from}", { from: r.from }),
      r.game.name,
      undefined,
      "/activity?view=boost-inbox",
    );
  }
  if (!since) return stamp;
  const likes = await likesOnMine(since).catch(() => []);
  const names = [...new Set(likes.map((l) => l.online_id).filter(Boolean))] as string[];
  if (names.length === 1) {
    await notify("social", `likes:${stamp}`, t("❤️ {name} curtiu sua conquista", { name: names[0] }), t("Veja em Atividades."));
  } else if (names.length > 1) {
    await notify(
      "social",
      `likes:${stamp}`,
      t("❤️ {n} jogadores curtiram suas conquistas", { n: names.length }),
      names.slice(0, 3).join(", "),
    );
  }
  return stamp;
}

async function checkUpdate(notified: number | null): Promise<number | null> {
  const current = Number(BUILD_NUMBER);
  // Na versão da Play Store, a própria loja avisa e instala as atualizações.
  if (!Number.isFinite(current) || isPlayStoreBuild()) return notified;
  const result = await checkForUpdate();
  if (result.status !== "available" || result.latest === notified) return notified;
  await notify("updates", `update:${result.latest}`, t("⬇️ Nova versão do Trophy Mania"), t("Toque em Configurações → Atualizações para instalar."));
  return result.latest;
}
