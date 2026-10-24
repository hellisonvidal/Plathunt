import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { mapLimit } from "../lib/cache";
import { compareTitles, completionSpans, formatSpan, type CompletionSpan } from "../lib/stats";
import { SERIES_COLORS } from "./charts";
import { locale, t } from "../i18n";
import type { Title } from "../psn/types";
import { GameIcon, ProgressBar } from "./ui";

interface Row {
  title: Title;
  platinum: CompletionSpan | null;
  full: CompletionSpan | null;
}

const date = (iso: string) => new Date(iso).toLocaleDateString(locale());

/** "Platina em {time}" com o tempo em negrito, no lugar que a tradução pedir. */
function WithTime({ text, time }: { text: string; time: string }) {
  const [before, after] = text.split("{time}");
  return (
    <span>
      {before}
      <strong>{time}</strong>
      {after}
    </span>
  );
}

type Kind = "platinum" | "full";

// 100% só de jogos com DLC: nos outros, o 100% é o mesmo momento da platina.
const ofKind = (r: Row, k: Kind) => (k === "full" ? (r.title.hasGroups ? r.full : null) : r.platinum);

/**
 * Datas de platina e 100% dos jogos concluídos de um jogador, buscadas aos
 * poucos (vão aparecendo conforme chegam).
 */
function useCompletionRows(titles: Title[], accountId: string) {
  const { client } = useApp();
  const done = titles.filter((t) => t.earned.platinum > 0 || t.progress === 100);
  const key = done.map((t) => t.id).join(",");
  const [rows, setRows] = useState<Map<string, Row | null>>(new Map());

  useEffect(() => {
    let alive = true;
    setRows(new Map());
    void mapLimit(done, 4, async (title) => {
      const row = await client
        .gameTrophies(accountId, title)
        .then((trophies) => ({ title, ...completionSpans(trophies) }))
        .catch(() => null);
      if (alive) setRows((prev) => new Map(prev).set(title.id, row));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key, accountId]);

  return {
    total: done.length,
    read: rows.size,
    loaded: [...rows.values()].filter((r): r is Row => !!r),
  };
}

const average = (spans: CompletionSpan[]) => (spans.length ? spans.reduce((n, s) => n + s.ms, 0) / spans.length : 0);
const fastestOf = (spans: CompletionSpan[]) => (spans.length ? Math.min(...spans.map((s) => s.ms)) : 0);

/**
 * Estatísticas → quanto tempo levou cada platina e cada 100%, do primeiro
 * troféu ao último. Comparando com um amigo, mostra a média e o mais rápido
 * de cada um e os jogos em comum lado a lado (quem foi mais rápido).
 */
export function CompletionTimes({
  titles,
  accountId = "me",
  name,
  compare,
}: {
  titles: Title[];
  accountId?: string;
  /** Nome do jogador (na comparação). */
  name?: string;
  /** Amigo para comparar (já filtrado pela plataforma). */
  compare?: { accountId: string; name: string; titles: Title[] };
}) {
  const mine = useCompletionRows(titles, accountId);
  const theirs = useCompletionRows(compare?.titles ?? [], compare?.accountId ?? "");
  const [sort, setSort] = useState<"recentes" | "rapidos" | "lentos">("recentes");
  // Platina e 100% em listas separadas: num jogo sem DLC os dois tempos são iguais.
  const [kind, setKind] = useState<Kind>("platinum");
  const [showAll, setShowAll] = useState(false);
  // Comparando: só os jogos em comum ou todos os do jogador.
  const [scope, setScope] = useState<"common" | "mine">("common");
  const done = { length: mine.total };
  const rows = { size: mine.read };
  const loaded = mine.loaded;

  if (!done.length) return null;
  const counts = {
    platinum: loaded.filter((r) => ofKind(r, "platinum")).length,
    full: loaded.filter((r) => ofKind(r, "full")).length,
  };
  const list = loaded.filter((r) => ofKind(r, kind)).map((r) => ({ title: r.title, span: ofKind(r, kind)! }));
  const sorted = [...list].sort((a, b) =>
    sort === "rapidos"
      ? a.span.ms - b.span.ms
      : sort === "lentos"
        ? b.span.ms - a.span.ms
        : Date.parse(b.span.end) - Date.parse(a.span.end),
  );
  const spans = list.map((r) => r.span);
  const avg = average(spans);
  const fastest = fastestOf(spans);
  const loading = rows.size < done.length || (!!compare && theirs.read < theirs.total);
  const shown = showAll ? sorted : sorted.slice(0, 10);

  // Comparação: os tempos do amigo e os jogos em comum (pelo nome).
  const comparing = !!compare;
  const theirSpans = theirs.loaded.map((r) => ofKind(r, kind)).filter((s): s is CompletionSpan => !!s);
  const theirList = theirs.loaded.filter((r) => ofKind(r, kind));
  const pairs = comparing
    ? compareTitles(
        list.map((r) => r.title),
        theirList.map((r) => r.title),
      ).common.map(({ mine: a, theirs: b }) => ({
        title: a,
        theirTitle: b,
        a: list.find((r) => r.title === a)!.span,
        b: ofKind(theirList.find((r) => r.title === b)!, kind)!,
      }))
    : [];
  const sortedPairs = [...pairs].sort((x, y) =>
    sort === "rapidos"
      ? x.a.ms - y.a.ms
      : sort === "lentos"
        ? y.a.ms - x.a.ms
        : Math.max(Date.parse(y.a.end), Date.parse(y.b.end)) - Math.max(Date.parse(x.a.end), Date.parse(x.b.end)),
  );
  const faster = [pairs.filter((p) => p.a.ms < p.b.ms).length, pairs.filter((p) => p.b.ms < p.a.ms).length];
  const players = [
    { name: name || t("Você"), spans, accountId },
    { name: compare?.name ?? "", spans: theirSpans, accountId: compare?.accountId ?? "" },
  ];
  const showCommon = comparing && scope === "common";
  const shownPairs = showAll ? sortedPairs : sortedPairs.slice(0, 10);

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("⏱️ Tempo até a platina / 100%")}</h2>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label={t("Ordenar tempos")}
          className="rounded-full border border-line bg-surface-2 px-2 py-1 text-xs"
        >
          <option value="recentes">{t("Mais recentes")}</option>
          <option value="rapidos">{t("Mais rápidos")}</option>
          <option value="lentos">{t("Mais demorados")}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm" role="tablist">
        {(
          [
            ["platinum", t("🏆 Platinas ({n})", { n: counts.platinum })],
            ["full", t("💯 100% ({n})", { n: counts.full })],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={kind === key}
            onClick={() => setKind(key)}
            className={`rounded-lg py-1.5 font-semibold ${kind === key ? "bg-ps-blue" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[0.6875rem] text-muted">
        {kind === "platinum"
          ? t("Do primeiro troféu conquistado até a platina.")
          : t("Só jogos com DLC: do primeiro troféu conquistado até o último, contando as DLCs.")}
      </p>

      {comparing && (
        <div className="grid grid-cols-2 gap-2">
          {players.map((p, i) => (
            <div key={i} className="min-w-0 rounded-xl bg-surface-2 p-2">
              <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                {p.name}
              </p>
              <p className="mt-1 text-[0.6875rem] text-muted">{kind === "platinum" ? t("Média por platina") : t("Média por 100%")}</p>
              <p className="font-bold">{p.spans.length ? formatSpan(average(p.spans)) : "—"}</p>
              <p className="text-[0.6875rem] text-muted">{kind === "platinum" ? t("Platina mais rápida") : t("100% mais rápido")}</p>
              <p className="font-bold">{p.spans.length ? formatSpan(fastestOf(p.spans)) : "—"}</p>
            </div>
          ))}
        </div>
      )}
      {comparing && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-xs" role="tablist">
          {(
            [
              ["common", t("Em comum ({n})", { n: pairs.length })],
              ["mine", t("Só {name}", { name: players[0].name }) + ` (${list.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={scope === key}
              onClick={() => setScope(key)}
              className={`truncate rounded-lg px-1 py-1.5 font-semibold ${scope === key ? "bg-ps-blue" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {showCommon && pairs.length > 0 && (
        <p className="text-xs text-muted">
          {t("Mais rápido: {a} em {n}, {b} em {m}", {
            a: players[0].name,
            n: faster[0],
            b: players[1].name,
            m: faster[1],
          })}
        </p>
      )}
      {showCommon && !loading && !pairs.length && (
        <p className="text-xs text-muted">{t("Nenhum jogo em comum concluído pelos dois.")}</p>
      )}

      {!comparing && spans.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-[0.6875rem] text-muted">{kind === "platinum" ? t("Média por platina") : t("Média por 100%")}</p>
            <p className="font-bold">{formatSpan(avg)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-[0.6875rem] text-muted">{kind === "platinum" ? t("Platina mais rápida") : t("100% mais rápido")}</p>
            <p className="font-bold">{formatSpan(fastest)}</p>
          </div>
        </div>
      )}
      {!showCommon && !loading && !spans.length && (
        <p className="text-xs text-muted">
          {kind === "platinum" ? t("Nenhuma platina por aqui ainda.") : t("Nenhum jogo com DLC 100% por aqui ainda.")}
        </p>
      )}

      {loading && (
        <div className="space-y-1">
          <p className="text-xs text-muted">
            {t("Lendo as datas dos troféus… {n} de {total} jogos", {
              n: rows.size + theirs.read,
              total: done.length + theirs.total,
            })}
          </p>
          <ProgressBar value={((rows.size + theirs.read) / Math.max(1, done.length + theirs.total)) * 100} />
        </div>
      )}

      {showCommon && (
        <ul className="divide-y divide-line">
          {shownPairs.map((p) => (
            <li key={p.title.id} className="flex items-center gap-3 py-2.5">
              <Link to={`/game/${accountId}/${p.title.id}?service=${p.title.service}`} className="shrink-0">
                <GameIcon src={p.title.iconUrl} size={44} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/game/${accountId}/${p.title.id}?service=${p.title.service}`}
                  className="block truncate text-sm font-semibold"
                >
                  {p.title.name}
                </Link>
                {[
                  { span: p.a, other: p.b, title: p.title, player: players[0] },
                  { span: p.b, other: p.a, title: p.theirTitle, player: players[1] },
                ].map(({ span, other, title, player }, i) => (
                  <Link
                    key={i}
                    to={`/game/${player.accountId}/${title.id}?service=${title.service}`}
                    className="mt-0.5 flex items-center gap-1.5 text-xs"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                    <span className="w-24 shrink-0 truncate text-muted">{player.name}</span>
                    <span className={span.ms < other.ms ? "font-bold" : ""}>{formatSpan(span.ms)}</span>
                    {span.ms < other.ms && <span aria-label={t("Mais rápido")}>⚡</span>}
                    <span className="ml-auto text-[0.6875rem] text-muted">{date(span.end)}</span>
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {showCommon && sortedPairs.length > 10 && (
        <button onClick={() => setShowAll((s) => !s)} className="w-full text-sm font-semibold text-ps-blue-2">
          {showAll ? t("Mostrar menos") : t("Ver todos ({n})", { n: sortedPairs.length })}
        </button>
      )}

      {!showCommon && (
      <ul className="divide-y divide-line">
        {shown.map((r) => (
          <li key={r.title.id}>
            <Link to={`/game/${accountId}/${r.title.id}?service=${r.title.service}`} className="flex items-center gap-3 py-2.5">
              <GameIcon src={r.title.iconUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.title.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <span className="w-4 text-center">{kind === "platinum" ? "🏆" : "💯"}</span>
                  <WithTime
                    text={kind === "platinum" ? t("Platina em {time}") : t("100% em {time}")}
                    time={formatSpan(r.span.ms)}
                  />
                  <span className="ml-auto text-[0.6875rem] text-muted">
                    {date(r.span.start)} → {date(r.span.end)}
                  </span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      )}
      {!showCommon && sorted.length > 10 && (
        <button onClick={() => setShowAll((s) => !s)} className="w-full text-sm font-semibold text-ps-blue-2">
          {showAll ? t("Mostrar menos") : t("Ver todos ({n})", { n: sorted.length })}
        </button>
      )}
    </section>
  );
}
