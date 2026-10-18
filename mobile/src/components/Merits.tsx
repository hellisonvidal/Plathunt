import { useState } from "react";
import { useApp } from "../app";
import { locale, t } from "../i18n";
import { evaluateMerits, MERIT_CATEGORIES, meritDescription, meritName, type MeritResult } from "../lib/merits";
import { challengeStats, getChallenges } from "../lib/challenges";
import { meritDateLabel, recordMeritDates, type MeritDate } from "../lib/meritDates";
import { countReactedItems } from "../lib/reactions";
import { matchPlayed } from "../lib/stats";
import { useData } from "../lib/useData";
import { Avatar, ErrorBox, ProgressBar, Spinner } from "./ui";
import { mapLimit } from "../lib/cache";

/**
 * Méritos (Atividades → Méritos): conquistas do app por objetivos, divididas
 * em categorias. Dá para ver os seus ou os de um amigo com troféus públicos.
 */
export function MeritsView() {
  const [tab, setTab] = useState<"meus" | "ranking">("meus");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1 text-sm" role="tablist">
        {(
          [
            ["meus", t("🏅 Méritos")],
            ["ranking", t("🏆 Ranking de méritos")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-xl py-2 font-semibold ${tab === key ? "bg-ps-blue" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "ranking" ? <MeritRanking /> : <MyMerits />}
    </div>
  );
}

function MyMerits() {
  const { client } = useApp();
  const [who, setWho] = useState("me");

  const friends = useData((force) => client.friends(force), [client]);
  const { data, error, loading, refresh } = useData(
    async (force) => {
      const isMe = who === "me";
      const [profile, titles, played, friendIds] = await Promise.all([
        isMe ? client.me(force) : client.profile(who, force),
        client.titles(who, force).catch(() => null),
        client.playedGames(who, force),
        isMe ? client.friendIds(force) : Promise.resolve(null),
      ]);
      if (!titles) return { who, results: null, dates: {} as Record<string, MeritDate> };
      const play = matchPlayed(titles, played ?? []);
      const results = evaluateMerits({
        profile,
        titles,
        playtime: new Map([...play].map(([id, p]) => [id, p.seconds])),
        playedOn: new Map([...play].map(([id, p]) => [id, p.platform])),
        friends: friendIds ? friendIds.length : null,
        reactions: isMe ? countReactedItems() : null,
        challenges: isMe ? challengeStats(getChallenges()) : null,
        now: Date.now(),
      });
      // Data de conquista: a do último troféu do jogo que liberou o mérito; sem
      // troféu de origem (nível, tempo, amigos...), a primeira vez que o app o viu liberado.
      const recorded = recordMeritDates(
        profile.accountId,
        results.filter((r) => r.done).map((r) => r.merit.id),
      );
      const dates: Record<string, MeritDate> = { ...recorded };
      for (const r of results) if (r.done && r.at) dates[r.merit.id] = { at: new Date(r.at).toISOString(), before: false };
      return { who, results, dates };
    },
    [client, who],
  );

  // Ao trocar de jogador, os méritos do anterior ficam até os novos chegarem.
  const current = data?.who === who ? data : null;
  const results = current?.results ?? null;
  const dates = current?.dates ?? {};
  // Últimos liberados (só os com data exata, não os de antes do registro).
  const recent = (results ?? [])
    .filter((r) => r.done && dates[r.merit.id] && !dates[r.merit.id].before)
    .sort((a, b) => dates[b.merit.id].at.localeCompare(dates[a.merit.id].at))
    .slice(0, 3);
  const unlocked = results?.filter((r) => r.done).length ?? 0;
  const next = results
    ?.filter((r) => !r.done)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm">
        <span className="text-muted">{t("Méritos de")}</span>
        <select
          value={who}
          onChange={(e) => setWho(e.target.value)}
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
        >
          <option value="me">{t("Você")}</option>
          {[...(friends.data ?? [])]
            .sort((a, b) => a.onlineId.localeCompare(b.onlineId, locale(), { sensitivity: "base" }))
            .map((f) => (
              <option key={f.accountId} value={f.accountId}>
                {f.onlineId}
              </option>
            ))}
        </select>
      </label>

      {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
      {(loading || !current) && !error && <Spinner label={t("Calculando os méritos…")} />}
      {current && !results && (
        <p className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
          {t("Os troféus deste jogador são privados, então não dá para calcular os méritos.")}
        </p>
      )}

      {results && (
        <>
          <section className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">{t("Méritos desbloqueados")}</p>
                <p className="text-3xl font-bold">
                  {unlocked}
                  <span className="text-base font-medium text-muted"> / {results.length}</span>
                </p>
              </div>
              <span className="text-4xl" aria-hidden>
                🏅
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar value={(unlocked / results.length) * 100} />
            </div>
            {recent.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Conquistados recentemente")}</p>
                <ul className="space-y-2">
                  {recent.map((r) => (
                    <MeritRow key={r.merit.id} result={r} date={dates[r.merit.id]} />
                  ))}
                </ul>
              </div>
            )}
            {next && next.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Próximos objetivos")}</p>
                <ul className="space-y-2">
                  {next.map((r) => (
                    <MeritRow key={r.merit.id} result={r} />
                  ))}
                </ul>
              </div>
            )}
          </section>

          <p className="px-1 text-[0.6875rem] text-muted">
            📅{" "}
            {t(
              "A data de cada mérito é a do último troféu do jogo que o liberou (a PSN informa a data da última conquista de cada jogo). Méritos sem troféu de origem (nível, tempo de jogo, amigos, curtidas e desafios) usam a primeira vez que o app os viu liberados; os que já estavam liberados aparecem como “conquistado até” aquela data.",
            )}
          </p>

          {MERIT_CATEGORIES.map((cat) => {
            const list = results.filter((r) => r.merit.category === cat.id);
            if (!list.length) return null;
            return <CategorySection key={cat.id} label={t(cat.label)} icon={cat.icon} list={list} dates={dates} />;
          })}
        </>
      )}
    </div>
  );
}

function CategorySection({
  label,
  icon,
  list,
  dates,
}: {
  label: string;
  icon: string;
  list: MeritResult[];
  dates: Record<string, MeritDate>;
}) {
  const [open, setOpen] = useState(false);
  const done = list.filter((r) => r.done).length;
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-2"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{label}</span>
          <span className="mt-1 block">
            <ProgressBar value={(done / list.length) * 100} />
          </span>
        </span>
        <span className="text-sm tabular-nums text-muted">
          {done}/{list.length}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="space-y-2 border-t border-line p-3">
          {list.map((r) => (
            <MeritRow key={r.merit.id} result={r} date={dates[r.merit.id]} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MeritRow({ result, date }: { result: MeritResult; date?: MeritDate }) {
  const { merit, done, value, ratio } = result;
  return (
    <li
      className={`flex items-center gap-3 rounded-xl p-3 ${
        done ? "border border-gold/40 bg-gold/10" : "bg-surface-2"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl ${
          done ? "bg-gold/20" : "bg-surface opacity-50 grayscale"
        }`}
        aria-hidden
      >
        {merit.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          {meritName(merit)}
          {done && <span className="text-gold">✓</span>}
        </p>
        <p className="text-xs text-muted">{meritDescription(merit)}</p>
        {done && date && (
          <p
            className="mt-0.5 text-[0.6875rem] font-semibold text-gold"
            title={date.before ? t("Já estava liberado quando o app começou a registrar as datas") : undefined}
          >
            📅 {meritDateLabel(date)}
          </p>
        )}
        {!done && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1">
              <ProgressBar value={ratio * 100} />
            </div>
            <span className="text-[0.6875rem] tabular-nums text-muted">
              {(value ?? 0).toLocaleString(locale())}/{merit.target.toLocaleString(locale())}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

interface RankingRow {
  accountId: string;
  onlineId: string;
  avatarUrl: string | null;
  unlocked: number;
  total: number;
  isMe: boolean;
}

/** Ranking de méritos guardado na memória enquanto o app está aberto. */
let rankingCache: { at: number; rows: RankingRow[] } | null = null;

/**
 * Ranking de méritos entre você e os amigos com troféus públicos. Para ser
 * justo, conta só os méritos calculados pelos dados da PSN (sem amigos,
 * curtidas e desafios, que só existem no seu app).
 */
function MeritRanking() {
  const { client } = useApp();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { data, error, loading, refresh } = useData(
    async (force) => {
      if (!force && rankingCache && Date.now() - rankingCache.at < 30 * 60_000) return rankingCache.rows;
      const [me, friends] = await Promise.all([client.me(force), client.friends(force)]);
      const players = [
        { profile: me, accountId: "me", isMe: true },
        ...friends.filter((f) => f.level !== null).map((f) => ({ profile: f, accountId: f.accountId, isMe: false })),
      ];
      let done = 0;
      setProgress({ done, total: players.length });
      const rows = await mapLimit(players, 4, async (p): Promise<RankingRow | null> => {
        try {
          const [titles, played] = await Promise.all([client.titles(p.accountId, force), client.playedGames(p.accountId, force)]);
          const play = matchPlayed(titles, played ?? []);
          const results = evaluateMerits({
            profile: p.profile,
            titles,
            playtime: new Map([...play].map(([id, x]) => [id, x.seconds])),
            playedOn: new Map([...play].map(([id, x]) => [id, x.platform])),
            friends: null,
            reactions: null,
            challenges: null,
            now: Date.now(),
          });
          return {
            accountId: p.profile.accountId,
            onlineId: p.profile.onlineId,
            avatarUrl: p.profile.avatarUrl,
            unlocked: results.filter((r) => r.done).length,
            total: results.length,
            isMe: p.isMe,
          };
        } catch {
          return null;
        } finally {
          setProgress({ done: ++done, total: players.length });
        }
      });
      const list = rows
        .filter((r): r is RankingRow => !!r)
        .sort((a, b) => b.unlocked - a.unlocked || a.onlineId.localeCompare(b.onlineId, locale(), { sensitivity: "base" }));
      rankingCache = { at: Date.now(), rows: list };
      return list;
    },
    [client],
  );

  return (
    <div className="space-y-3">
      {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
      {loading && !data && (
        <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">
            {progress
              ? t("Calculando os méritos dos amigos… {n} de {total}", { n: progress.done, total: progress.total })
              : t("Calculando os méritos…")}
          </p>
          <ProgressBar value={progress && progress.total ? (progress.done / progress.total) * 100 : 5} />
        </div>
      )}
      {data && (
        <>
          <ol className="space-y-2">
            {data.map((r, i) => (
              <li
                key={r.accountId}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  r.isMe ? "border-ps-blue-2 bg-ps-blue-2/10" : "border-line bg-surface"
                }`}
              >
                <span className="w-7 text-center text-lg font-bold tabular-nums">
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                </span>
                <Avatar src={r.avatarUrl} name={r.onlineId} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.isMe ? t("{name} (você)", { name: r.onlineId }) : r.onlineId}</span>
                  <span className="mt-1 block">
                    <ProgressBar value={(r.unlocked / Math.max(1, r.total)) * 100} />
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold tabular-nums">{r.unlocked.toLocaleString(locale())}</span>
                  <span className="text-[0.6875rem] text-muted">{t("méritos")}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="px-1 text-[0.6875rem] text-muted">
            {t(
              "Conta só os méritos calculados pelos troféus e jogos da PSN; amigos, curtidas e desafios ficam de fora para todos. Amigos com troféus privados não entram.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
