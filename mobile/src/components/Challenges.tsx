import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { sameGame, shareLinks, type BoostCandidate } from "../lib/boost";
import { mapLimit } from "../lib/cache";
import {
  addChallenge,
  CHALLENGE_DEADLINES,
  challengeMessage,
  findTrophy,
  isFinished,
  platinumGoal,
  rankChallenge,
  removeChallenge,
  saveResults,
  STATUS_LABELS,
  useChallenges,
  type Challenge,
  type ChallengePlayer,
} from "../lib/challenges";
import { useData } from "../lib/useData";
import type { Title } from "../psn/types";
import { GamePicker, TrophyPicker } from "./GamePicker";
import { Avatar, ErrorBox, GameIcon, RemoteImage, Spinner, TrophyBadge, rarityLabel, timeAgo } from "./ui";

/**
 * Atividades → Desafios: fixe um troféu como objetivo, escolha os rivais e
 * veja quem conquista primeiro. As posições vêm das datas da PSN.
 */
export function ChallengesView() {
  const challenges = useChallenges();
  const [creating, setCreating] = useState(challenges.length === 0);
  const active = challenges.filter((c) => !isFinished(c));
  const finished = challenges.filter((c) => isFinished(c));

  return (
    <div className="space-y-4">
      {creating ? (
        <ChallengeForm onClose={() => setCreating(false)} />
      ) : (
        <button onClick={() => setCreating(true)} className="w-full rounded-2xl bg-ps-blue py-3 font-semibold">
          🏁 Novo desafio
        </button>
      )}

      {active.length > 0 && <h2 className="text-sm font-semibold text-muted">Em andamento ({active.length})</h2>}
      {active.map((c) => (
        <ChallengeCard key={c.id} challenge={c} />
      ))}

      {finished.length > 0 && (
        <details className="rounded-2xl border border-line bg-surface p-3 text-sm">
          <summary className="font-semibold">Encerrados ({finished.length})</summary>
          <div className="mt-3 space-y-3">
            {finished.map((c) => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        </details>
      )}

      <p className="pb-2 text-center text-[0.6875rem] text-muted">
        Vence quem conquistar o troféu primeiro depois do início do desafio (e dentro do prazo). Quem já tinha o troféu
        não conta. Seus desafios ficam salvos neste celular e contam para os Méritos.
      </p>
    </div>
  );
}

function ChallengeForm({ onClose }: { onClose: () => void }) {
  const { client } = useApp();
  const [game, setGame] = useState<BoostCandidate | null>(null);
  const [trophy, setTrophy] = useState<Challenge["trophy"] | null>(null);
  const [rivals, setRivals] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const me = useData((force) => client.me(force), [client]);
  // Amigos com troféus públicos; quem tem o jogo aparece primeiro.
  const friends = useData(
    async (force) => {
      if (!game) return null;
      const list = await client.friends(force);
      const owners = await mapLimit(list, 5, async (f) => {
        if (f.level === null) return false;
        const titles = await client
          .titles(f.accountId)
          .catch(() => client.recentTitles(f.accountId).catch(() => [] as Title[]));
        return titles.some((t) => sameGame(t, { id: game.title?.id ?? game.key, name: game.name }));
      });
      return list
        .map((f, i) => ({ ...f, hasGame: owners[i] }))
        .filter((f) => f.level !== null)
        .sort((a, b) => Number(b.hasGame) - Number(a.hasGame) || a.onlineId.localeCompare(b.onlineId, "pt-BR", { sensitivity: "base" }));
    },
    [client, game?.key],
  );
  const shownFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (friends.data ?? []).filter((f) => !q || f.onlineId.toLowerCase().includes(q));
  }, [friends.data, query]);

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`;

  const create = () => {
    if (!game || !trophy || !me.data) return;
    const players: ChallengePlayer[] = [
      { accountId: "me", onlineId: me.data.onlineId, avatarUrl: me.data.avatarUrl },
      ...(friends.data ?? [])
        .filter((f) => rivals.includes(f.accountId))
        .map((f) => ({ accountId: f.accountId, onlineId: f.onlineId, avatarUrl: f.avatarUrl })),
    ];
    addChallenge(
      {
        game: {
          name: game.name,
          iconUrl: game.iconUrl,
          titleId: game.title?.id ?? game.key,
          service: game.title?.service ?? "trophy2",
          platform: game.platforms.join("/"),
        },
        trophy,
        players,
      },
      deadline,
    );
    onClose();
  };

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4" aria-label="Novo desafio">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">🏁 Novo desafio</h2>
        <button onClick={onClose} className="text-sm text-muted" aria-label="Fechar">
          ✕
        </button>
      </div>

      {!game ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">1. Escolha o jogo (todo o catálogo PlayStation, por plataforma ou pela busca)</p>
          <GamePicker onPick={setGame} />
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
                setTrophy(null);
                setRivals([]);
              }}
              className="text-xs text-ps-blue-2 underline"
            >
              Trocar
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted">2. Escolha o troféu do desafio</p>
            {trophy ? (
              <div className="flex items-center gap-3 rounded-xl border border-ps-blue-2 bg-surface-2 p-2">
                <RemoteImage
                  src={trophy.iconUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg"
                  fallback={<span className="flex h-10 w-10 items-center justify-center">🏆</span>}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{trophy.name}</span>
                    <TrophyBadge type={trophy.type} />
                  </span>
                  {trophy.detail && <span className="line-clamp-2 text-[0.6875rem] text-muted">{trophy.detail}</span>}
                </span>
                <button onClick={() => setTrophy(null)} className="text-xs text-ps-blue-2 underline">
                  Trocar
                </button>
              </div>
            ) : game.title ? (
              <div className="space-y-2">
                <button
                  onClick={() => setTrophy(platinumGoal())}
                  className="w-full rounded-xl border border-dashed border-line p-2 text-sm font-semibold text-ps-blue-2"
                >
                  🏆 Corrida da platina (quem platinar primeiro)
                </button>
                <TrophyPicker
                  game={game}
                  selected={[]}
                  multiple={false}
                  onChange={(_, rows) => {
                    const t = rows[0];
                    if (t)
                      setTrophy({ id: t.id, name: t.name, detail: t.detail, type: t.type, iconUrl: t.iconUrl, rate: t.rate });
                  }}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted">
                  Ninguém da sua lista jogou este jogo ainda, então a PSN não mostra a lista de troféus. O desafio pode ser
                  a corrida da platina: vence quem platinar primeiro.
                </p>
                <button onClick={() => setTrophy(platinumGoal())} className="w-full rounded-xl bg-ps-blue py-2.5 font-semibold">
                  🏆 Desafio: platina do jogo
                </button>
              </div>
            )}
          </div>

          {trophy && (
            <>
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  3. Rivais{rivals.length > 0 && ` · ${rivals.length} escolhidos`}
                </p>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar amigo"
                  className="w-full rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
                />
                {friends.error ? <ErrorBox error={friends.error} onRetry={friends.refresh} /> : null}
                {friends.loading && !friends.data && <Spinner label="Vendo quais amigos têm o jogo…" />}
                <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {shownFriends.map((f) => {
                    const on = rivals.includes(f.accountId);
                    return (
                      <li key={f.accountId}>
                        <button
                          aria-pressed={on}
                          onClick={() =>
                            setRivals((list) => (on ? list.filter((id) => id !== f.accountId) : [...list, f.accountId]))
                          }
                          className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${
                            on ? "border-ps-blue-2 bg-surface-2" : "border-line"
                          }`}
                        >
                          <Avatar src={f.avatarUrl} name={f.onlineId} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{f.onlineId}</span>
                            <span className={`text-[0.6875rem] ${f.hasGame ? "text-online" : "text-muted"}`}>
                              {f.hasGame ? "Tem o jogo" : "Sem o jogo na lista recente"}
                            </span>
                          </span>
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                              on ? "border-ps-blue-2 bg-ps-blue font-bold" : "border-line"
                            }`}
                            aria-hidden
                          >
                            {on ? "✓" : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted">4. Prazo</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Prazo">
                  {CHALLENGE_DEADLINES.map((d) => (
                    <button
                      key={d.label}
                      role="radio"
                      aria-checked={deadline === d.days}
                      onClick={() => setDeadline(d.days)}
                      className={chip(deadline === d.days)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={create}
                disabled={rivals.length === 0 || !me.data}
                className="w-full rounded-xl bg-ps-blue py-3 font-semibold disabled:opacity-50"
              >
                {rivals.length === 0 ? "Escolha pelo menos um rival" : "Começar desafio"}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}

function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const { client } = useApp();
  const [copied, setCopied] = useState(false);
  const finished = isFinished(c);

  // Apura as posições: para cada jogador, a data em que conquistou o troféu.
  const check = useData(
    async (force) => {
      const game = { id: c.game.titleId, name: c.game.name };
      const raw = Object.fromEntries(
        await mapLimit(c.players, 3, async (p) => {
          const titles = await (p.accountId === "me" ? client.titles("me", force) : client.titles(p.accountId, force)).catch(
            () => null,
          );
          if (!titles) return [p.accountId, "privado"] as const;
          const title = titles.find((t) => t.id === game.id) ?? titles.find((t) => sameGame(t, game));
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
    },
    [client, c.id],
  );
  const results = check.data ?? c.results;

  const order = (id: string) => results[id]?.position ?? 100 + ["pendente", "fora-do-prazo", "ja-tinha", "sem-jogo", "privado"].indexOf(results[id]?.status ?? "pendente");
  const players = [...c.players].sort((a, b) => order(a.accountId) - order(b.accountId));
  const winner = c.players.find((p) => results[p.accountId]?.status === "venceu");
  const me = c.players.find((p) => p.accountId === "me");
  const text = challengeMessage(c, me?.onlineId ?? "eu");
  const left = c.deadline ? Math.ceil((Date.parse(c.deadline) - Date.now()) / 86_400_000) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const btn = "rounded-full border border-line px-3 py-1.5 text-xs font-semibold";

  return (
    <article className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <RemoteImage
          src={c.trophy.iconUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl"
          fallback={<GameIcon src={c.game.iconUrl} size={56} />}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{c.trophy.name}</span>
            <TrophyBadge type={c.trophy.type} />
          </p>
          <p className="truncate text-xs text-muted">{c.game.name}</p>
          <p className="text-[0.6875rem] text-muted">
            {[
              `criado ${timeAgo(c.createdAt)}`,
              finished ? "encerrado" : left !== null ? `${Math.max(0, left)} ${left === 1 ? "dia" : "dias"} restantes` : "sem prazo",
              rarityLabel(c.trophy.rate),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      {c.trophy.detail && <p className="rounded-xl bg-surface-2 p-2.5 text-xs">{c.trophy.detail}</p>}

      {winner && (
        <p className="rounded-xl bg-surface-2 p-2.5 text-sm font-semibold">
          🏆 {winner.accountId === "me" ? "Você venceu!" : `${winner.onlineId} venceu!`}
        </p>
      )}

      {check.error ? <ErrorBox error={check.error} onRetry={check.refresh} /> : null}
      {check.loading && !check.data && <p className="text-xs text-muted">Conferindo os troféus de cada jogador…</p>}

      <ol className="space-y-1.5" aria-label="Classificação">
        {players.map((p) => {
          const r = results[p.accountId];
          return (
            <li key={p.accountId} className="flex items-center gap-3 rounded-xl border border-line p-2">
              <span className="w-6 text-center text-sm font-bold text-muted">{r?.position ? `${r.position}º` : "–"}</span>
              <Link to={p.accountId === "me" ? "/" : `/u/${p.accountId}`} className="shrink-0">
                <Avatar src={p.avatarUrl} name={p.onlineId} size={36} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.accountId === "me" ? `${p.onlineId} (você)` : p.onlineId}</p>
                <p className={`text-[0.6875rem] ${r?.status === "venceu" ? "font-semibold text-online" : "text-muted"}`}>
                  {STATUS_LABELS[r?.status ?? "pendente"]}
                  {r?.earnedAt && ` · ${new Date(r.earnedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <a href={shareLinks(text).whatsapp} target="_blank" rel="noreferrer" className={btn}>
          Chamar no WhatsApp
        </a>
        <button onClick={copy} className={btn}>
          {copied ? "Copiado ✔" : "Copiar convite"}
        </button>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted">{c.checkedAt ? `Conferido ${timeAgo(c.checkedAt)}` : ""}</span>
        <button onClick={() => removeChallenge(c.id)} className="text-muted underline">
          Apagar
        </button>
      </div>
    </article>
  );
}
