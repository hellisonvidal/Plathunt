import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import {
  addBoost,
  BOOST_WHEN,
  boostMessage,
  removeBoost,
  sameGame,
  shareLinks,
  updateBoost,
  useBoosts,
  type Boost,
  type BoostCandidate,
} from "../lib/boost";
import { t } from "../i18n";
import {
  boostLink,
  cloudPayload,
  importBoost,
  removeFromInbox,
  setInboxStatus,
  syncCloudInbox,
  useInbox,
  type ReceivedBoost,
} from "../lib/boostInbox";
import { appUsers, myBoostRequests, sendBoostRequests, useCloud } from "../lib/cloud";
import { cancelNotification, notify } from "../lib/notify";
import { mapLimit } from "../lib/cache";
import { presenceRank, presenceText } from "../lib/presence";
import { useData } from "../lib/useData";
import type { Title } from "../psn/types";
import { GamePicker, TrophyPicker } from "./GamePicker";
import { StatusDot } from "./StatusDot";
import { Avatar, ErrorBox, GameIcon, Spinner, timeAgo } from "./ui";

/**
 * Atividades → Boost: convocação para fazer troféus online/cooperativos de um
 * jogo escolhido. Mostra quais amigos têm o jogo (e quem está online agora) e
 * gera o convite para mandar em qualquer conversa.
 */
export function BoostView({ initialTab = "meus" }: { initialTab?: "meus" | "recebidos" }) {
  const boosts = useBoosts();
  const inbox = useInbox();
  const [tab, setTab] = useState<"meus" | "recebidos">(initialTab);
  const [creating, setCreating] = useState(boosts.length === 0);
  const open = boosts.filter((b) => !b.done);
  const done = boosts.filter((b) => b.done);
  const fresh = inbox.filter((r) => r.status === "novo").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 text-xs" role="tablist">
        {(
          [
            ["meus", t("📣 Meus pedidos")],
            ["recebidos", fresh ? t("📥 Pedidos recebidos ({n})", { n: fresh }) : t("📥 Pedidos recebidos")],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-lg py-2 font-semibold ${tab === k ? "bg-ps-blue" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "recebidos" ? (
        <BoostInbox />
      ) : creating ? (
        <BoostForm onClose={() => setCreating(false)} />
      ) : (
        <button onClick={() => setCreating(true)} className="w-full rounded-2xl bg-ps-blue py-3 font-semibold">
          {t("📣 Nova convocação de boost")}
        </button>
      )}

      {open.map((b) => (
        <BoostCard key={b.id} boost={b} />
      ))}

      {done.length > 0 && (
        <details className="rounded-2xl border border-line bg-surface p-3 text-sm">
          <summary className="font-semibold">{t("Concluídas ({n})", { n: done.length })}</summary>
          <div className="mt-3 space-y-3">
            {done.map((b) => (
              <BoostCard key={b.id} boost={b} />
            ))}
          </div>
        </details>
      )}

      <p className="pb-2 text-center text-[0.6875rem] text-muted">
        {t(
          "A PSN não deixa outros apps enviarem mensagens: a convocação vira um texto pronto para mandar no WhatsApp, Telegram, Discord ou nas mensagens da PSN. Suas convocações ficam salvas neste celular.",
        )}
      </p>
    </div>
  );
}

function BoostForm({ onClose }: { onClose: () => void }) {
  const [game, setGame] = useState<BoostCandidate | null>(null);
  const [players, setPlayers] = useState(1);
  const [when, setWhen] = useState<string>(BOOST_WHEN[0]);
  const [trophyIds, setTrophyIds] = useState<number[]>([]);
  const [trophies, setTrophies] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4" aria-label={t("Nova convocação")}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{t("📣 Convocar boost")}</h2>
        <button onClick={onClose} className="text-sm text-muted" aria-label={t("Fechar")}>
          ✕
        </button>
      </div>

      <p className="text-[0.6875rem] text-muted">{t("Só aparecem os troféus que você ainda não tem.")}</p>

      {!game ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">{t("1. Escolha o jogo (por plataforma ou pela busca)")}</p>
          <GamePicker onPick={setGame} multiplayer />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-line p-2">
            <GameIcon src={game.iconUrl} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{game.name}</span>
              <span className="text-[0.6875rem] text-muted">{game.platforms.join(" · ")}</span>
            </span>
            <button
              onClick={() => {
                setGame(null);
                setTrophyIds([]);
                setTrophies([]);
              }}
              className="text-xs text-ps-blue-2 underline"
            >
              {t("Trocar")}
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">
              {t("2. Troféus que precisam de boost")}
              {trophies.length > 0 && ` · ${t("{n} escolhidos", { n: trophies.length })}`}
            </p>
            <TrophyPicker
              game={game}
              earned="hide"
              selected={trophyIds}
              onChange={(ids, rows) => {
                setTrophyIds(ids);
                setTrophies(rows.map((r) => r.name));
              }}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">{t("3. Quantos jogadores faltam?")}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setPlayers((n) => Math.max(1, n - 1))} className={chip(false)} aria-label={t("Menos")}>
                −
              </button>
              <span className="w-8 text-center text-lg font-bold" aria-live="polite">
                {players}
              </span>
              <button onClick={() => setPlayers((n) => Math.min(15, n + 1))} className={chip(false)} aria-label={t("Mais")}>
                +
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">{t("4. Quando?")}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Quando")}>
              {BOOST_WHEN.map((w) => (
                <button key={w} role="radio" aria-checked={when === w} onClick={() => setWhen(w)} className={chip(when === w)}>
                  {t(w)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">{t("5. Recado (opcional)")}</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder={t("Ex.: preciso de 2 vitórias no online, tenho microfone")}
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-ps-blue-2"
            />
          </div>

          <button
            onClick={() => {
              const boost = addBoost({
                game: { id: game.title?.id ?? game.key, name: game.name, platform: game.platforms.join("/"), iconUrl: game.iconUrl },
                players,
                when,
                trophies,
                note,
                kind: "pedido",
              });
              scheduleBoostReminder(boost);
              onClose();
            }}
            className="w-full rounded-xl bg-ps-blue py-3 font-semibold"
          >
            {t("Criar convocação")}
          </button>
        </>
      )}
    </section>
  );
}

function BoostCard({ boost: b }: { boost: Boost }) {
  const { client } = useApp();
  const me = useData((force) => client.me(force), [client]);
  const [showFriends, setShowFriends] = useState(!b.done);
  const [copied, setCopied] = useState(false);
  const myId = me.data?.onlineId ?? t("eu");
  // O link leva o pedido junto: quem recebe abre no app e vê em "Pedidos recebidos".
  const text =
    boostMessage(b, myId) +
    (b.kind === "ajuda" ? "" : `\n🔗 ${t("Abrir no Trophy Mania")}: ${boostLink(b, myId)}`);
  const links = shareLinks(text);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // WebView sem área de transferência: seleciona o texto na tela.
      const el = document.getElementById(`boost-text-${b.id}`);
      if (el) window.getSelection()?.selectAllChildren(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const btn = "rounded-full border border-line px-3 py-1.5 text-xs font-semibold";
  return (
    <article className={`space-y-3 rounded-2xl border border-line bg-surface p-4 ${b.done ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-3">
        <GameIcon src={b.game.iconUrl} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{b.game.name}</p>
          <p className="text-xs text-muted">
            {b.players === 1 ? t("👥 {n} jogador", { n: b.players }) : t("👥 {n} jogadores", { n: b.players })} · 🕒{" "}
            {t(b.when)} · {timeAgo(b.createdAt)}
          </p>
          {b.joined.length > 0 && (
            <p className="text-xs font-semibold text-online">
              {b.joined.length === 1
                ? t("✔ {n} topou: {names}", { n: b.joined.length, names: b.joined.join(", ") })
                : t("✔ {n} toparam: {names}", { n: b.joined.length, names: b.joined.join(", ") })}
            </p>
          )}
        </div>
      </div>

      <pre
        id={`boost-text-${b.id}`}
        className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-xs leading-relaxed"
      >
        {text}
      </pre>

      <div className="flex flex-wrap gap-2">
        {canShare && (
          <button onClick={() => navigator.share({ text }).catch(() => {})} className={`${btn} bg-ps-blue`}>
            {t("Compartilhar")}
          </button>
        )}
        <a href={links.whatsapp} target="_blank" rel="noreferrer" className={btn}>
          WhatsApp
        </a>
        <a href={links.telegram} target="_blank" rel="noreferrer" className={btn}>
          Telegram
        </a>
        <button onClick={copy} className={btn}>
          {copied ? t("Copiado ✔") : t("Copiar texto")}
        </button>
      </div>

      <button
        onClick={() => setShowFriends((s) => !s)}
        aria-expanded={showFriends}
        className="flex w-full items-center justify-between rounded-xl border border-line px-3 py-2 text-sm"
      >
        <span>{t("Amigos que têm este jogo")}</span>
        <span className="text-muted">{showFriends ? "▴" : "▾"}</span>
      </button>
      {showFriends && <FriendsWithGame boost={b} />}
      {b.kind !== "ajuda" && !b.done && <SendInApp boost={b} myId={myId} />}

      <div className="flex justify-between text-xs">
        <button onClick={() => updateBoost(b.id, { done: !b.done })} className="font-semibold text-ps-blue-2">
          {b.done ? t("Reabrir") : t("✔ Marcar como concluída")}
        </button>
        <button
          onClick={() => {
            removeBoost(b.id);
            void cancelNotification(`boost:${b.id}`);
          }}
          className="text-muted underline"
        >
          {t("Apagar")}
        </button>
      </div>
    </article>
  );
}

/** Amigos com o jogo (mesmo id ou o mesmo jogo em outra plataforma), online primeiro. */
function FriendsWithGame({ boost: b }: { boost: Boost }) {
  const { client } = useApp();
  const { data, error, loading, refresh } = useData(
    async (force) => {
      const ids = await client.friendIds(force);
      const owners = (
        await mapLimit(ids, 5, async (id) => {
          const titles = await client.recentTitles(id, force).catch(() => [] as Title[]);
          const hit = titles.find((t) => sameGame(t, b.game));
          return hit ? { id, progress: hit.progress } : null;
        })
      ).filter((o): o is { id: string; progress: number } => o !== null);
      const [profiles, presences] = await Promise.all([
        mapLimit(owners, 5, (o) => client.profile(o.id).catch(() => null)),
        client.presences(owners.map((o) => o.id), force),
      ]);
      return owners
        .map((o, i) => ({ ...o, profile: profiles[i], presence: presences[o.id] }))
        .filter((o) => o.profile)
        .sort((x, y) => presenceRank(x.presence) - presenceRank(y.presence) || x.progress - y.progress);
    },
    [client, b.game.id],
  );

  if (error) return <ErrorBox error={error} onRetry={refresh} />;
  if (loading && !data) return <Spinner label={t("Procurando o jogo na lista dos seus amigos…")} />;
  if (!data?.length)
    return (
      <p className="text-center text-sm text-muted">
        {t("Nenhum amigo com troféus públicos jogou {game} recentemente. Mande a convocação nos grupos!", {
          game: b.game.name,
        })}
      </p>
    );

  const online = data.filter((f) => f.presence?.status === "online").length;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {data.length === 1
          ? t("{n} amigo tem o jogo · {online} online agora", { n: data.length, online })
          : t("{n} amigos têm o jogo · {online} online agora", { n: data.length, online })}
      </p>
      <ul className="space-y-1.5">
        {data.map(({ id, progress, profile, presence }) => {
          const name = profile!.onlineId;
          const joined = b.joined.includes(name);
          return (
            <li key={id} className="flex items-center gap-3 rounded-xl border border-line p-2">
              <Link to={`/u/${id}`} className="relative shrink-0">
                <Avatar src={profile!.avatarUrl} name={name} size={40} />
                {presence && <StatusDot status={presence.status} />}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p
                  className={`truncate text-[0.6875rem] ${presence?.status === "online" ? "font-semibold text-online" : "text-muted"}`}
                >
                  {presenceText(presence)} · {t("{p}% do jogo", { p: progress })}
                </p>
              </div>
              <button
                aria-pressed={joined}
                onClick={() =>
                  updateBoost(b.id, { joined: joined ? b.joined.filter((n) => n !== name) : [...b.joined, name] })
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold ${joined ? "bg-online text-black" : "border border-line text-muted"}`}
              >
                {joined ? t("Topou ✔") : t("Topou?")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Horário do lembrete conforme o "quando" do pedido (Hoje à noite: 20h; Amanhã: 20h; Fim de semana: sábado 15h). */
export function boostReminderTime(when: string, from = new Date()): Date | null {
  const at = new Date(from);
  at.setSeconds(0, 0);
  if (when === "Hoje à noite") at.setHours(20, 0);
  else if (when === "Amanhã") {
    at.setDate(at.getDate() + 1);
    at.setHours(20, 0);
  } else if (when === "Fim de semana") {
    at.setDate(at.getDate() + ((6 - at.getDay() + 7) % 7));
    at.setHours(15, 0);
  } else return null;
  return at.getTime() > from.getTime() ? at : null;
}

function scheduleBoostReminder(b: Boost) {
  const at = boostReminderTime(b.when);
  if (at) void notify("boost", `boost:${b.id}`, t("📣 Hora do boost!"), t("{game}: chame a galera para os troféus.", { game: b.game.name }), at);
}

/**
 * Pedidos recebidos: só pedidos de outros jogadores, que chegam pelo link da
 * mensagem (abre o app) ou colando a mensagem aqui. Ao aceitar, o app monta a
 * resposta oferecendo ajuda, pronta para enviar.
 */
function BoostInbox() {
  const { client } = useApp();
  const me = useData((force) => client.me(force), [client]);
  const inbox = useInbox();
  const { identity } = useCloud();
  // Pedidos que chegaram direto no app (recursos online).
  useEffect(() => {
    if (identity) void syncCloudInbox().catch(() => {});
  }, [identity]);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const add = (value: string) => {
    const result = importBoost(value, me.data?.onlineId ?? null);
    if (!result.ok) {
      setMessage(
        result.reason === "meu"
          ? t("Esse pedido é seu. Aqui aparecem só os pedidos de outros jogadores.")
          : t("Não encontrei um pedido de boost nessa mensagem."),
      );
      return;
    }
    setMessage(result.duplicate ? t("Esse pedido já estava na lista.") : t("Pedido de {from} adicionado.", { from: result.request.from }));
    setText("");
  };
  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setText(clip);
      add(clip);
    } catch {
      setMessage(t("Não deu para ler a área de transferência. Cole a mensagem no campo abaixo."));
    }
  };

  const fresh = inbox.filter((r) => r.status === "novo");
  const accepted = inbox.filter((r) => r.status === "aceito");
  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">{t("📥 Receber um pedido")}</h2>
        <p className="text-xs text-muted">
          {t("Toque no link do pedido que um amigo mandou (WhatsApp, Telegram…) ou cole a mensagem aqui.")}
        </p>
        <button onClick={paste} className="w-full rounded-xl bg-ps-blue py-2.5 text-sm font-semibold">
          {t("📋 Colar pedido copiado")}
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={t("Cole aqui a mensagem do pedido")}
          className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-ps-blue-2"
        />
        <button
          onClick={() => add(text)}
          disabled={!text.trim()}
          className="w-full rounded-xl border border-line py-2 text-sm font-semibold disabled:opacity-50"
        >
          {t("Adicionar pedido")}
        </button>
        {message && <p className="text-xs text-ps-blue-2" aria-live="polite">{message}</p>}
      </section>

      {inbox.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          {t("Nenhum pedido recebido ainda.")}
        </p>
      )}
      {fresh.length > 0 && <h3 className="text-sm font-semibold text-muted">{t("Novos ({n})", { n: fresh.length })}</h3>}
      {fresh.map((r) => (
        <ReceivedCard key={r.id} request={r} me={me.data?.onlineId ?? t("eu")} />
      ))}
      {accepted.length > 0 && <h3 className="text-sm font-semibold text-muted">{t("Aceitos ({n})", { n: accepted.length })}</h3>}
      {accepted.map((r) => (
        <ReceivedCard key={r.id} request={r} me={me.data?.onlineId ?? t("eu")} />
      ))}
    </div>
  );
}

function ReceivedCard({ request: r, me }: { request: ReceivedBoost; me: string }) {
  const [copied, setCopied] = useState(false);
  const reply = boostMessage({ ...r, kind: "ajuda" }, me);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reply);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const btn = "rounded-full border border-line px-3 py-1.5 text-xs font-semibold";
  return (
    <article className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <GameIcon src={r.game.iconUrl} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{r.game.name}</p>
          <p className="text-xs text-muted">
            {t("Pedido de {from}", { from: r.from })} · {r.game.platform} · {timeAgo(r.receivedAt)}
          </p>
          <p className="text-xs text-muted">
            {r.players === 1 ? t("👥 {n} jogador", { n: r.players }) : t("👥 {n} jogadores", { n: r.players })} · 🕒{" "}
            {t(r.when)}
          </p>
        </div>
      </div>
      {r.trophies.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-surface-2 p-2.5 text-xs">
          {r.trophies.map((name) => (
            <li key={name}>🏆 {name}</li>
          ))}
        </ul>
      )}
      {r.note && <p className="text-xs">📝 {r.note}</p>}

      {r.status === "novo" ? (
        <div className="flex gap-2">
          <button
            onClick={() => setInboxStatus(r.id, "aceito")}
            className="flex-1 rounded-xl bg-ps-blue py-2 text-sm font-semibold"
          >
            {t("🤝 Aceitar e ajudar")}
          </button>
          <button onClick={() => removeFromInbox(r.id)} className="rounded-xl border border-line px-3 py-2 text-sm text-muted">
            {t("Recusar")}
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-online">{t("✔ Você aceitou. Envie a resposta para {from}:", { from: r.from })}</p>
          <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-xs leading-relaxed">{reply}</pre>
          <div className="flex flex-wrap gap-2">
            <a href={shareLinks(reply).whatsapp} target="_blank" rel="noreferrer" className={btn}>
              WhatsApp
            </a>
            <a href={shareLinks(reply).telegram} target="_blank" rel="noreferrer" className={btn}>
              Telegram
            </a>
            <button onClick={copy} className={btn}>
              {copied ? t("Copiado ✔") : t("Copiar texto")}
            </button>
            <button onClick={() => removeFromInbox(r.id)} className={`${btn} text-muted`}>
              {t("Apagar")}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

/**
 * Recursos online: envia o pedido direto para o app dos amigos que também
 * usam o Trophy Mania e mostra quem já respondeu.
 */
function SendInApp({ boost: b, myId }: { boost: Boost; myId: string }) {
  const { client } = useApp();
  const { identity } = useCloud();
  const [chosen, setChosen] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const data = useData(async () => {
    if (!identity) return null;
    const [ids, { sent }] = await Promise.all([client.friendIds(), myBoostRequests()]);
    const users = await appUsers(ids);
    const answers = new Map(
      sent.filter((r) => (r.payload as { boostId?: string }).boostId === b.id).map((r) => [r.to_account_id, r.status]),
    );
    return { users: [...users].sort((x, y) => x[1].localeCompare(y[1])), answers };
  }, [client, identity?.accountId, b.id]);

  if (!identity) {
    return (
      <p className="rounded-xl bg-surface-2 p-2.5 text-[0.6875rem] text-muted">
        {t("Ligue os recursos online em Configurações para enviar o pedido direto no app dos amigos.")}
      </p>
    );
  }
  if (data.loading && !data.data) return <p className="text-xs text-muted">{t("Procurando amigos que usam o app…")}</p>;
  const users = data.data?.users ?? [];
  const answers = data.data?.answers ?? new Map<string, string>();
  const label = (status: string | undefined) =>
    status === "aceito" ? t("✔ Aceitou") : status === "recusado" ? t("Recusou") : status ? t("Enviado") : null;

  return (
    <section className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-sm font-semibold">{t("📲 Enviar direto no app")}</p>
      {users.length === 0 ? (
        <p className="text-xs text-muted">{t("Nenhum amigo seu usa o Trophy Mania com recursos online ainda.")}</p>
      ) : (
        <>
          <ul className="space-y-1">
            {users.map(([accountId, name]) => {
              const status = answers.get(accountId);
              const on = chosen.includes(accountId);
              return (
                <li key={accountId}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!!status}
                      checked={on || !!status}
                      onChange={() => setChosen((l) => (on ? l.filter((x) => x !== accountId) : [...l, accountId]))}
                      className="h-4 w-4 accent-[var(--color-ps-blue)]"
                    />
                    <span className="flex-1 truncate">{name}</span>
                    {status && (
                      <span className={`text-[0.6875rem] ${status === "aceito" ? "font-semibold text-online" : "text-muted"}`}>
                        {label(status)}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            disabled={!chosen.length || sending}
            onClick={async () => {
              setSending(true);
              try {
                await sendBoostRequests(chosen, cloudPayload(b, myId));
                setChosen([]);
                data.refresh();
              } catch {
                // Sem conexão: o usuário pode tentar de novo.
              } finally {
                setSending(false);
              }
            }}
            className="w-full rounded-xl bg-ps-blue py-2 text-sm font-semibold disabled:opacity-50"
          >
            {sending ? t("Enviando…") : t("Enviar pedido ({n})", { n: chosen.length })}
          </button>
        </>
      )}
    </section>
  );
}
