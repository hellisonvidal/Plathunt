import { useMemo, useState } from "react";
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
} from "../lib/boost";
import { mapLimit } from "../lib/cache";
import { presenceRank, presenceText } from "../lib/presence";
import { useData } from "../lib/useData";
import type { Title } from "../psn/types";
import { StatusDot } from "./StatusDot";
import { Avatar, ErrorBox, GameIcon, Spinner, timeAgo } from "./ui";

/**
 * Atividades → Boost: convocação para fazer troféus online/cooperativos de um
 * jogo escolhido. Mostra quais amigos têm o jogo (e quem está online agora) e
 * gera o convite para mandar em qualquer conversa.
 */
export function BoostView() {
  const boosts = useBoosts();
  const [creating, setCreating] = useState(boosts.length === 0);
  const open = boosts.filter((b) => !b.done);
  const done = boosts.filter((b) => b.done);

  return (
    <div className="space-y-4">
      {creating ? (
        <BoostForm onClose={() => setCreating(false)} />
      ) : (
        <button onClick={() => setCreating(true)} className="w-full rounded-2xl bg-ps-blue py-3 font-semibold">
          📣 Nova convocação de boost
        </button>
      )}

      {open.map((b) => (
        <BoostCard key={b.id} boost={b} />
      ))}

      {done.length > 0 && (
        <details className="rounded-2xl border border-line bg-surface p-3 text-sm">
          <summary className="font-semibold">Concluídas ({done.length})</summary>
          <div className="mt-3 space-y-3">
            {done.map((b) => (
              <BoostCard key={b.id} boost={b} />
            ))}
          </div>
        </details>
      )}

      <p className="pb-2 text-center text-[0.6875rem] text-muted">
        A PSN não deixa outros apps enviarem mensagens: a convocação vira um texto pronto para mandar no WhatsApp,
        Telegram, Discord ou nas mensagens da PSN. Suas convocações ficam salvas neste celular.
      </p>
    </div>
  );
}

function BoostForm({ onClose }: { onClose: () => void }) {
  const { client } = useApp();
  const titles = useData((force) => client.titles("me", force), [client]);
  const [query, setQuery] = useState("");
  const [game, setGame] = useState<Title | null>(null);
  const [players, setPlayers] = useState(1);
  const [when, setWhen] = useState<string>(BOOST_WHEN[0]);
  const [trophies, setTrophies] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const trophyList = useData(
    async () => (game ? (await client.gameTrophies("me", game)).filter((t) => !t.earned) : null),
    [client, game?.id],
  );

  // Jogos não platinados e mais recentes primeiro.
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (titles.data ?? [])
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .sort((a, b) => Number(a.progress === 100) - Number(b.progress === 100) || b.lastUpdated.localeCompare(a.lastUpdated))
      .slice(0, 8);
  }, [titles.data, query]);

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4" aria-label="Nova convocação">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">📣 Convocar boost</h2>
        <button onClick={onClose} className="text-sm text-muted" aria-label="Fechar">
          ✕
        </button>
      </div>

      {!game ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">1. Escolha o jogo</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nos seus jogos"
            className="w-full rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
          />
          {titles.error ? <ErrorBox error={titles.error} onRetry={titles.refresh} /> : null}
          {titles.loading && !titles.data && <Spinner label="Carregando seus jogos…" />}
          <ul className="space-y-1.5">
            {options.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setGame(t)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line p-2 text-left active:border-muted"
                >
                  <GameIcon src={t.iconUrl} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.name}</span>
                    <span className="text-[0.6875rem] text-muted">
                      {t.platform} · {t.progress}%
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {titles.data && options.length === 0 && <p className="text-sm text-muted">Nenhum jogo com “{query}”.</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-line p-2">
            <GameIcon src={game.iconUrl} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{game.name}</span>
              <span className="text-[0.6875rem] text-muted">{game.platform}</span>
            </span>
            <button
              onClick={() => {
                setGame(null);
                setTrophies([]);
              }}
              className="text-xs text-ps-blue-2 underline"
            >
              Trocar
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">2. Quantos jogadores faltam?</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setPlayers((n) => Math.max(1, n - 1))} className={chip(false)} aria-label="Menos">
                −
              </button>
              <span className="w-8 text-center text-lg font-bold" aria-live="polite">
                {players}
              </span>
              <button onClick={() => setPlayers((n) => Math.min(15, n + 1))} className={chip(false)} aria-label="Mais">
                +
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">3. Quando?</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quando">
              {BOOST_WHEN.map((w) => (
                <button key={w} role="radio" aria-checked={when === w} onClick={() => setWhen(w)} className={chip(when === w)}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">4. Troféus que precisam de boost (opcional)</p>
            {trophyList.loading && !trophyList.data && <Spinner label="Carregando os troféus que faltam…" />}
            {trophyList.data && trophyList.data.length === 0 && (
              <p className="text-sm text-muted">Você já tem todos os troféus deste jogo.</p>
            )}
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {(trophyList.data ?? []).slice(0, 60).map((t) => {
                const on = trophies.includes(t.name);
                return (
                  <button
                    key={t.id}
                    aria-pressed={on}
                    onClick={() => setTrophies((list) => (on ? list.filter((n) => n !== t.name) : [...list, t.name]))}
                    className={`${chip(on)} text-left text-xs`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">5. Recado (opcional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Ex.: preciso de 2 vitórias no online, tenho microfone"
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-ps-blue-2"
            />
          </div>

          <button
            onClick={() => {
              addBoost({
                game: { id: game.id, name: game.name, platform: game.platform, iconUrl: game.iconUrl },
                players,
                when,
                trophies,
                note,
              });
              onClose();
            }}
            className="w-full rounded-xl bg-ps-blue py-3 font-semibold"
          >
            Criar convocação
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
  const text = boostMessage(b, me.data?.onlineId ?? "eu");
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
            👥 {b.players} {b.players === 1 ? "jogador" : "jogadores"} · 🕒 {b.when} · {timeAgo(b.createdAt)}
          </p>
          {b.joined.length > 0 && (
            <p className="text-xs font-semibold text-online">
              ✔ {b.joined.length} {b.joined.length === 1 ? "topou" : "toparam"}: {b.joined.join(", ")}
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
            Compartilhar
          </button>
        )}
        <a href={links.whatsapp} target="_blank" rel="noreferrer" className={btn}>
          WhatsApp
        </a>
        <a href={links.telegram} target="_blank" rel="noreferrer" className={btn}>
          Telegram
        </a>
        <button onClick={copy} className={btn}>
          {copied ? "Copiado ✔" : "Copiar texto"}
        </button>
      </div>

      <button
        onClick={() => setShowFriends((s) => !s)}
        aria-expanded={showFriends}
        className="flex w-full items-center justify-between rounded-xl border border-line px-3 py-2 text-sm"
      >
        <span>Amigos que têm este jogo</span>
        <span className="text-muted">{showFriends ? "▴" : "▾"}</span>
      </button>
      {showFriends && <FriendsWithGame boost={b} />}

      <div className="flex justify-between text-xs">
        <button onClick={() => updateBoost(b.id, { done: !b.done })} className="font-semibold text-ps-blue-2">
          {b.done ? "Reabrir" : "✔ Marcar como concluída"}
        </button>
        <button onClick={() => removeBoost(b.id)} className="text-muted underline">
          Apagar
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
  if (loading && !data) return <Spinner label="Procurando o jogo na lista dos seus amigos…" />;
  if (!data?.length)
    return (
      <p className="text-center text-sm text-muted">
        Nenhum amigo com troféus públicos jogou {b.game.name} recentemente. Mande a convocação nos grupos!
      </p>
    );

  const online = data.filter((f) => f.presence?.status === "online").length;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {data.length} {data.length === 1 ? "amigo tem" : "amigos têm"} o jogo · {online} online agora
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
                  {presenceText(presence)} · {progress}% do jogo
                </p>
              </div>
              <button
                aria-pressed={joined}
                onClick={() =>
                  updateBoost(b.id, { joined: joined ? b.joined.filter((n) => n !== name) : [...b.joined, name] })
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold ${joined ? "bg-online text-black" : "border border-line text-muted"}`}
              >
                {joined ? "Topou ✔" : "Topou?"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
