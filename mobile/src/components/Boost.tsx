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
  cloudPayload,
  inviteLines,
  removeFromInbox,
  setInboxStatus,
  syncCloudInbox,
  useInbox,
  type ReceivedBoost,
} from "../lib/boostInbox";
import { appUsers, cloudAvailable, connectCloud, myBoostRequests, sendBoostRequests, useCloud } from "../lib/cloud";
import { cancelNotification, notify } from "../lib/notify";
import { mapLimit } from "../lib/cache";
import { presenceRank, presenceText } from "../lib/presence";
import { useBackInterceptor } from "../lib/backButton";
import { useData } from "../lib/useData";
import { isNativeApp, openInBrowser, shareText } from "../psn/native";
import type { Title } from "../psn/types";
import { GamePicker, TrophyPicker } from "./GamePicker";
import { StatusDot } from "./StatusDot";
import { Avatar, ErrorBox, GameIcon, Spinner, timeAgo } from "./ui";

/**
 * Atividades → Boost: convocação para fazer troféus online/cooperativos de um
 * jogo escolhido. Mostra quais amigos têm o jogo (e quem está online agora) e
 * gera o convite para mandar em qualquer conversa.
 */
export function BoostView({
  initialTab = "meus",
  focus = null,
}: {
  initialTab?: "meus" | "recebidos";
  /** Pedido recebido em destaque (aberto por uma notificação ou link). */
  focus?: string | null;
}) {
  const boosts = useBoosts();
  const inbox = useInbox();
  const [tab, setTab] = useState<"meus" | "recebidos">(initialTab);
  // O catálogo de jogos só carrega quando o formulário abre (botão "Novo boost").
  const [creating, setCreating] = useState(false);
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
        <BoostInbox focus={focus} />
      ) : (
        <>
          <button onClick={() => setCreating(true)} className="w-full rounded-2xl bg-ps-blue py-3 font-semibold">
            {t("➕ Novo boost")}
          </button>
          {creating && <BoostSheet onClose={() => setCreating(false)} />}
          {open.length === 0 && done.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
              {t("Nenhum pedido de boost ainda. Toque em Novo boost para chamar a galera.")}
            </p>
          )}
          {open.map((b) => (
            <BoostCard key={b.id} boost={b} />
          ))}
        </>
      )}

      {tab === "meus" && done.length > 0 && (
        <details className="rounded-2xl border border-line bg-surface p-3 text-sm">
          <summary className="font-semibold">{t("Concluídas ({n})", { n: done.length })}</summary>
          <div className="mt-3 space-y-3">
            {done.map((b) => (
              <BoostCard key={b.id} boost={b} />
            ))}
          </div>
        </details>
      )}

      {tab === "meus" && (
        <p className="pb-2 text-center text-[0.6875rem] text-muted">
          {t(
            "A PSN não deixa outros apps enviarem mensagens: a convocação vira um texto pronto para mandar no WhatsApp, Telegram, Discord ou nas mensagens da PSN. Suas convocações ficam salvas neste celular.",
          )}
        </p>
      )}
    </div>
  );
}

/** Pop-up de confirmação (fica por cima do formulário; o voltar fecha só ele). */
function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useBackInterceptor(true, onCancel);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" data-no-pull>
      <button aria-label={cancelLabel} onClick={onCancel} className="absolute inset-0 bg-black/70" />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="relative w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-2xl">
        <h3 className="font-bold">{title}</h3>
        {children}
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${danger ? "bg-red-600 text-white" : "bg-ps-blue"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * "Convocar boost" em popup, subindo da parte de baixo da tela. Passos: jogo
 * multiplayer → troféus de multiplayer (com confirmação) → amigos para
 * convidar (pedido e notificação no app deles) e o convite para o WhatsApp.
 * Sair no meio (✕, tocar fora ou voltar) pede confirmação.
 */
function BoostSheet({ onClose }: { onClose: () => void }) {
  const [game, setGame] = useState<BoostCandidate | null>(null);
  const [players, setPlayers] = useState(1);
  const [when, setWhen] = useState<string>(BOOST_WHEN[0]);
  const [trophyIds, setTrophyIds] = useState<number[]>([]);
  const [trophies, setTrophies] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [quitting, setQuitting] = useState(false);
  // Depois de confirmar: o pedido criado, para convidar os amigos.
  const [created, setCreated] = useState<Boost | null>(null);
  const [pendingInvites, setPendingInvites] = useState(false);

  // Sair sem perder nada não pergunta; com um pedido pela metade (ou amigos
  // escolhidos e ainda não convidados), confirma a desistência.
  const dirty = created ? pendingInvites : !!game;
  const requestClose = () => (dirty ? setQuitting(true) : onClose());
  useBackInterceptor(true, requestClose);

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;

  const confirm = () => {
    if (!game) return;
    const boost = addBoost({
      game: { id: game.title?.id ?? game.key, name: game.name, platform: game.platforms.join("/"), iconUrl: game.iconUrl },
      players,
      when,
      trophies,
      note,
      kind: "pedido",
    });
    scheduleBoostReminder(boost);
    setConfirming(false);
    setCreated(boost);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" data-no-pull>
      <button aria-label={t("Fechar")} onClick={requestClose} className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        className="safe-bottom relative max-h-[92dvh] w-full max-w-2xl animate-[sheet-up_200ms_ease-out] overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-surface shadow-2xl"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <section className="space-y-4 p-4 pb-6" aria-label={t("Nova convocação")}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{created ? t("📨 Convidar amigos") : t("📣 Convocar boost")}</h2>
            <button onClick={requestClose} className="text-sm text-muted" aria-label={t("Fechar")}>
              ✕
            </button>
          </div>

          {created ? (
            <InviteStep boost={created} onPendingChange={setPendingInvites} onDone={onClose} />
          ) : !game ? (
            <div className="space-y-2">
              <p className="text-xs text-muted">{t("1. Escolha o jogo multiplayer")}</p>
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
                  {t("2. Troféus que dependem do multiplayer")}
                  {trophies.length > 0 && ` · ${t("{n} escolhidos", { n: trophies.length })}`}
                </p>
                <p className="mb-1.5 text-[0.6875rem] text-muted">
                  {t("Só aparecem os troféus online ou cooperativos que você ainda não tem.")}
                </p>
                <TrophyPicker
                  game={game}
                  earned="hide"
                  onlyMultiplayer
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
                disabled={!trophies.length}
                onClick={() => setConfirming(true)}
                className="w-full rounded-xl bg-ps-blue py-3 font-semibold disabled:opacity-50"
              >
                {trophies.length === 1
                  ? t("Continuar (1 troféu)")
                  : trophies.length
                    ? t("Continuar ({n} troféus)", { n: trophies.length })
                    : t("Escolha ao menos um troféu")}
              </button>
            </>
          )}
        </section>
      </div>

      {confirming && game && (
        <ConfirmDialog
          title={t("Confirmar os troféus do boost?")}
          confirmLabel={t("Confirmar")}
          cancelLabel={t("Revisar")}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
        >
          <p className="text-sm">
            <span className="font-semibold">{game.name}</span>
            <span className="text-muted">
              {" · "}
              {players === 1 ? t("👥 {n} jogador", { n: players }) : t("👥 {n} jogadores", { n: players })} · 🕒 {t(when)}
            </span>
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {trophies.map((name) => (
              <li key={name} className="rounded-lg bg-surface-2 px-2 py-1">
                🏆 {name}
              </li>
            ))}
          </ul>
          <p className="text-[0.6875rem] text-muted">{t("Depois você escolhe os amigos que vão receber o convite.")}</p>
        </ConfirmDialog>
      )}
      {quitting && (
        <ConfirmDialog
          title={created ? t("Sair sem enviar o convite?") : t("Desistir do pedido de boost?")}
          confirmLabel={created ? t("Sair") : t("Desistir")}
          cancelLabel={t("Continuar")}
          danger
          onConfirm={onClose}
          onCancel={() => setQuitting(false)}
        >
          <p className="text-sm text-muted">
            {created
              ? t("O pedido fica salvo em Meus pedidos, mas os amigos escolhidos não serão avisados.")
              : t("O que você preencheu será perdido.")}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

/**
 * Depois de confirmar os troféus: escolher os amigos (que usam o Plathunt)
 * que recebem o pedido e a notificação, e responder sim ou não no app. O
 * convite pelo WhatsApp fica sempre à mão, para quem ainda não tem o app.
 */
function InviteStep({
  boost: b,
  onPendingChange,
  onDone,
}: {
  boost: Boost;
  onPendingChange: (pending: boolean) => void;
  onDone: () => void;
}) {
  const { client } = useApp();
  const me = useData((force) => client.me(force), [client]);
  const myId = me.data?.onlineId ?? t("eu");
  const text = `${boostMessage(b, myId)}\n${inviteLines(b, myId)}`;
  const [sent, setSent] = useState(0);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-line p-2">
        <GameIcon src={b.game.iconUrl} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{b.game.name}</span>
          <span className="block truncate text-[0.6875rem] text-muted">{b.trophies.join(" · ")}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-online">{t("✔ Criado")}</span>
      </div>

      <SendInApp
        boost={b}
        myId={myId}
        onPendingChange={onPendingChange}
        onSent={(n) => setSent((s) => s + n)}
      />
      {sent > 0 && (
        <p className="rounded-xl bg-online/15 p-3 text-sm font-semibold text-online" role="status">
          {sent === 1
            ? t("✔ Convite enviado para 1 amigo. Ele recebe uma notificação e responde sim ou não.")
            : t("✔ Convite enviado para {n} amigos. Eles recebem uma notificação e respondem sim ou não.", { n: sent })}
        </p>
      )}

      <div className="space-y-2 rounded-xl border border-line p-3">
        <p className="text-sm font-semibold">{t("💬 Convidar pelo WhatsApp")}</p>
        <p className="text-[0.6875rem] text-muted">
          {t("O convite leva um link: abre o pedido no Plathunt ou, para quem não tem o app, a página de instalação.")}
        </p>
        <WhatsAppButton text={text} />
      </div>

      <button onClick={onDone} className="w-full rounded-xl border border-line py-3 font-semibold">
        {t("Concluir")}
      </button>
    </div>
  );
}

/** Botão do WhatsApp (abre o app com o texto pronto; escolhe a conversa lá). */
function WhatsAppButton({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <a
      href={shareLinks(text).whatsapp}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (!isNativeApp()) return;
        e.preventDefault();
        void openInBrowser(shareLinks(text).whatsapp);
      }}
      className={`flex items-center justify-center gap-2 rounded-xl bg-[#25d366] font-semibold text-black ${
        small ? "px-3 py-1.5 text-xs" : "w-full py-2.5 text-sm"
      }`}
    >
      <svg viewBox="0 0 24 24" className={small ? "h-4 w-4" : "h-5 w-5"} fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
      </svg>
      {t("Enviar convite pelo WhatsApp")}
    </a>
  );
}

function BoostCard({ boost: b }: { boost: Boost }) {
  const { client } = useApp();
  const me = useData((force) => client.me(force), [client]);
  const [showFriends, setShowFriends] = useState(!b.done);
  const [copied, setCopied] = useState(false);
  const myId = me.data?.onlineId ?? t("eu");
  // O link leva o pedido junto: quem recebe abre no app e vê em "Pedidos recebidos".
  const text = boostMessage(b, myId) + (b.kind === "ajuda" ? "" : `\n${inviteLines(b, myId)}`);
  const links = shareLinks(text);

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
        className="whitespace-pre-wrap break-all rounded-xl bg-surface-2 p-3 font-sans text-xs leading-relaxed"
      >
        {text}
      </pre>

      {/* O botão de compartilhar fica sempre no pedido: WhatsApp em destaque, depois os outros. */}
      <WhatsAppButton text={text} />
      <ShareButtons text={text} links={links} copied={copied} onCopy={copy} />

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
 * Compartilhar o texto: a tela de compartilhar do celular (WhatsApp, Telegram,
 * Discord, mensagens...), atalhos para WhatsApp e Telegram e copiar.
 */
function ShareButtons({
  text,
  links,
  copied,
  onCopy,
}: {
  text: string;
  links: { telegram: string };
  copied: boolean;
  onCopy: () => void;
}) {
  const btn = "rounded-full border border-line px-3 py-1.5 text-xs font-semibold";
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={async () => {
          if (!(await shareText(text, t("Compartilhar pedido de boost")))) onCopy();
        }}
        className={`${btn} border-ps-blue bg-ps-blue`}
      >
        {t("📤 Compartilhar")}
      </button>
      <a href={links.telegram} target="_blank" rel="noreferrer" className={btn}>
        Telegram
      </a>
      <button onClick={onCopy} className={btn}>
        {copied ? t("Copiado ✔") : t("Copiar texto")}
      </button>
    </div>
  );
}

/**
 * Pedidos recebidos: só pedidos de outros jogadores, que chegam pelo link da
 * mensagem (abre o app) ou direto no app (recursos online). Ao aceitar, o app
 * monta a resposta oferecendo ajuda, pronta para enviar.
 */
function BoostInbox({ focus }: { focus: string | null }) {
  const inbox = useInbox();
  const { identity } = useCloud();
  // Pedidos que chegaram direto no app (recursos online).
  useEffect(() => {
    if (identity) void syncCloudInbox().catch(() => {});
  }, [identity]);
  // Aberto por uma notificação ou link: rola até o pedido e o destaca.
  const [highlight, setHighlight] = useState<string | null>(focus);
  useEffect(() => {
    setHighlight(focus);
    if (!focus) return;
    const timer = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(timer);
  }, [focus]);
  useEffect(() => {
    if (!highlight) return;
    document.getElementById(`pedido-${highlight}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight, inbox.length]);

  const fresh = inbox.filter((r) => r.status === "novo");
  const accepted = inbox.filter((r) => r.status === "aceito");
  return (
    <div className="space-y-3">
      {inbox.length === 0 && (
        <div className="space-y-1 rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="text-sm text-muted">{t("Nenhum pedido recebido ainda.")}</p>
          <p className="text-xs text-muted">
            {t("Os pedidos de boost dos seus amigos chegam aqui, direto no app.")}
          </p>
        </div>
      )}
      {fresh.length > 0 && <h3 className="text-sm font-semibold text-muted">{t("Novos ({n})", { n: fresh.length })}</h3>}
      {fresh.map((r) => (
        <ReceivedCard key={r.id} request={r} highlight={highlight === r.id} />
      ))}
      {accepted.length > 0 && <h3 className="text-sm font-semibold text-muted">{t("Aceitos ({n})", { n: accepted.length })}</h3>}
      {accepted.map((r) => (
        <ReceivedCard key={r.id} request={r} highlight={highlight === r.id} />
      ))}
    </div>
  );
}

/** Pedido recebido: quem pediu, o jogo, os troféus e o que falta, com aceitar/recusar e a resposta pronta. */
function ReceivedCard({ request: r, highlight }: { request: ReceivedBoost; highlight: boolean }) {
  const chip = "rounded-full bg-surface-2 px-2 py-0.5";
  return (
    <article
      id={`pedido-${r.id}`}
      className={`overflow-hidden rounded-2xl border bg-surface transition-shadow ${
        highlight ? "border-ps-blue-2 shadow-[0_0_0_3px_var(--color-ps-blue-2)]" : r.status === "novo" ? "border-ps-blue-2/60" : "border-line"
      }`}
    >
      {/* Quem pediu e quando */}
      <div className="flex items-center gap-2.5 border-b border-line bg-surface-2 px-4 py-2.5">
        <Avatar src={null} name={r.from} size={32} />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{r.from}</span> <span className="text-muted">{t("pediu boost")}</span>
        </p>
        <span className="shrink-0 text-[0.6875rem] text-muted">{timeAgo(r.receivedAt)}</span>
        {r.status === "novo" && (
          <span className="shrink-0 rounded-full bg-ps-blue px-2 py-0.5 text-[0.625rem] font-bold uppercase">{t("Novo")}</span>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <GameIcon src={r.game.iconUrl} size={52} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold leading-snug">{r.game.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[0.6875rem] text-muted">
              {r.game.platform && <span className={chip}>{r.game.platform}</span>}
              <span className={chip}>
                {r.players === 1 ? t("👥 {n} jogador", { n: r.players }) : t("👥 {n} jogadores", { n: r.players })}
              </span>
              {r.when && <span className={chip}>🕒 {t(r.when)}</span>}
            </div>
          </div>
        </div>

        {r.trophies.length > 0 && (
          <div>
            <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">{t("Troféus")}</p>
            <ul className="flex flex-wrap gap-1.5 text-xs">
              {r.trophies.map((name) => (
                <li key={name} className="rounded-lg border border-line px-2 py-1">
                  🏆 {name}
                </li>
              ))}
            </ul>
          </div>
        )}
        {r.note && <p className="rounded-xl bg-surface-2 p-2.5 text-xs">📝 {r.note}</p>}

        {r.status === "novo" ? (
          <div className="flex gap-2">
            <button
              onClick={() => setInboxStatus(r.id, "aceito")}
              className="flex-1 rounded-xl bg-ps-blue py-2.5 text-sm font-semibold"
            >
              {t("👍 Sim, eu topo")}
            </button>
            <button onClick={() => removeFromInbox(r.id)} className="flex-1 rounded-xl border border-line py-2.5 text-sm text-muted">
              {t("👎 Não posso")}
            </button>
          </div>
        ) : (
          // A resposta fica no app: quem pediu vê em "Meus pedidos" que você topou.
          <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
            <p className="text-xs font-semibold text-online">
              {r.cloudId
                ? t("✔ Você topou ajudar. {from} vê sua resposta no Plathunt.", { from: r.from })
                : t("✔ Você topou ajudar {from}.", { from: r.from })}
            </p>
            <button onClick={() => removeFromInbox(r.id)} className="shrink-0 text-xs text-muted underline">
              {t("Apagar")}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Recursos online: envia o pedido direto para o app dos amigos que também
 * usam o Plathunt (eles recebem uma notificação e respondem sim ou não) e
 * mostra quem já respondeu.
 */
function SendInApp({
  boost: b,
  myId,
  onPendingChange,
  onSent,
}: {
  boost: Boost;
  myId: string;
  /** Há amigos marcados e ainda não convidados. */
  onPendingChange?: (pending: boolean) => void;
  onSent?: (count: number) => void;
}) {
  const { client } = useApp();
  const { identity, ready } = useCloud();
  const [chosen, setChosen] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  useEffect(() => onPendingChange?.(chosen.length > 0), [chosen.length, onPendingChange]);
  const data = useData(async () => {
    if (!identity) return null;
    const [ids, { sent }] = await Promise.all([client.friendIds(), myBoostRequests()]);
    const users = await appUsers(ids);
    const answers = new Map(
      sent.filter((r) => (r.payload as { boostId?: string }).boostId === b.id).map((r) => [r.to_account_id, r.status]),
    );
    // Avatar de cada amigo (perfis da PSN, guardados por 30 minutos).
    const list = [...users].sort((x, y) => x[1].localeCompare(y[1]));
    const profiles = await mapLimit(list, 5, ([id]) => client.profile(id).catch(() => null));
    return { users: list.map(([id, name], i) => ({ id, name, avatarUrl: profiles[i]?.avatarUrl ?? null })), answers };
  }, [client, identity?.accountId, b.id]);

  if (!ready) return null;
  if (!identity) {
    if (!cloudAvailable())
      return (
        <p className="rounded-xl bg-surface-2 p-2.5 text-[0.6875rem] text-muted">
          {t("Esta versão do app não envia pedidos direto no app dos amigos. Use o convite pelo WhatsApp.")}
        </p>
      );
    return (
      <div className="space-y-2 rounded-xl bg-surface-2 p-3">
        <p className="text-xs text-muted">
          {t("Para enviar o pedido direto no app dos amigos (com notificação e resposta sim ou não), ligue os recursos online.")}
        </p>
        <button
          disabled={connecting}
          onClick={async () => {
            setConnecting(true);
            try {
              await connectCloud();
            } catch {
              setFailed(true);
            } finally {
              setConnecting(false);
            }
          }}
          className="w-full rounded-xl bg-ps-blue py-2 text-sm font-semibold disabled:opacity-50"
        >
          {connecting ? t("Conectando…") : t("Ligar recursos online")}
        </button>
        {failed && <p className="text-[0.6875rem] text-red-400">{t("Não foi possível conectar. Tente de novo.")}</p>}
      </div>
    );
  }
  if (data.loading && !data.data) return <Spinner label={t("Procurando amigos que usam o app…")} />;
  const users = data.data?.users ?? [];
  const answers = data.data?.answers ?? new Map<string, string>();
  const label = (status: string | undefined) =>
    status === "aceito" ? t("👍 Topou") : status === "recusado" ? t("👎 Não pode") : status ? t("Aguardando resposta") : null;
  const free = users.filter((u) => !answers.has(u.id));
  const allOn = free.length > 0 && free.every((u) => chosen.includes(u.id));

  return (
    <section className="space-y-2 rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("📲 Enviar direto no app")}</p>
        {free.length > 1 && (
          <button onClick={() => setChosen(allOn ? [] : free.map((u) => u.id))} className="text-xs text-ps-blue-2 underline">
            {allOn ? t("Desmarcar todos") : t("Marcar todos")}
          </button>
        )}
      </div>
      {users.length === 0 ? (
        <p className="text-xs text-muted">
          {t("Nenhum amigo seu usa o Plathunt com recursos online ainda. Convide pelo WhatsApp: o link leva para a instalação.")}
        </p>
      ) : (
        <>
          <ul className="space-y-1">
            {users.map(({ id, name, avatarUrl }) => {
              const status = answers.get(id);
              const on = chosen.includes(id);
              return (
                <li key={id}>
                  <label className={`flex items-center gap-2.5 rounded-xl px-1 py-1 text-sm ${status ? "" : "active:bg-surface-2"}`}>
                    <input
                      type="checkbox"
                      disabled={!!status}
                      checked={on || !!status}
                      onChange={() => setChosen((l) => (on ? l.filter((x) => x !== id) : [...l, id]))}
                      className="h-4 w-4 shrink-0 accent-[var(--color-ps-blue)]"
                    />
                    <Avatar src={avatarUrl} name={name} size={32} />
                    <span className="flex-1 truncate">{name}</span>
                    {status && (
                      <span
                        className={`shrink-0 text-[0.6875rem] ${
                          status === "aceito" ? "font-semibold text-online" : status === "recusado" ? "text-red-400" : "text-muted"
                        }`}
                      >
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
              setFailed(false);
              try {
                const count = await sendBoostRequests(chosen, cloudPayload(b, myId));
                onSent?.(count || chosen.length);
                setChosen([]);
                data.refresh();
              } catch {
                setFailed(true);
              } finally {
                setSending(false);
              }
            }}
            className="w-full rounded-xl bg-ps-blue py-2 text-sm font-semibold disabled:opacity-50"
          >
            {sending ? t("Enviando…") : t("Enviar convite ({n})", { n: chosen.length })}
          </button>
          {failed && <p className="text-[0.6875rem] text-red-400">{t("Não foi possível enviar. Verifique a internet e tente de novo.")}</p>}
        </>
      )}
    </section>
  );
}
