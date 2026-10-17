import { useState } from "react";
import { useApp } from "../app";
import { locale, t } from "../i18n";
import { evaluateMerits, MERIT_CATEGORIES, meritDescription, meritName, type MeritResult } from "../lib/merits";
import { challengeStats, getChallenges } from "../lib/challenges";
import { meritDateLabel, recordMeritDates, type MeritDate } from "../lib/meritDates";
import { countReactedItems } from "../lib/reactions";
import { matchPlayed } from "../lib/stats";
import { useData } from "../lib/useData";
import { ErrorBox, ProgressBar, Spinner } from "./ui";

/**
 * Méritos (Atividades → Méritos): conquistas do app por objetivos, divididas
 * em categorias. Dá para ver os seus ou os de um amigo com troféus públicos.
 */
export function MeritsView() {
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
      // Data de conquista: a primeira vez que o app viu cada mérito liberado.
      const dates = recordMeritDates(
        profile.accountId,
        results.filter((r) => r.done).map((r) => r.merit.id),
      );
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
              "A data de cada mérito é registrada quando o app o vê liberado pela primeira vez. Os que já estavam liberados na primeira consulta aparecem como “conquistado até” aquela data.",
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
