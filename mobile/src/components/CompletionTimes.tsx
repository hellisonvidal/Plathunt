import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { mapLimit } from "../lib/cache";
import { completionSpans, formatSpan, type CompletionSpan } from "../lib/stats";
import { locale, t } from "../i18n";
import type { Title } from "../psn/types";
import { ProgressBar } from "./ui";

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

/**
 * Estatísticas → quanto tempo levou cada platina e cada 100%, do primeiro
 * troféu ao último. Busca as datas dos troféus de cada jogo concluído aos
 * poucos (vão aparecendo conforme chegam).
 */
export function CompletionTimes({ titles }: { titles: Title[] }) {
  const { client } = useApp();
  const done = titles.filter((t) => t.earned.platinum > 0 || t.progress === 100);
  const key = done.map((t) => t.id).join(",");
  const [rows, setRows] = useState<Map<string, Row | null>>(new Map());
  const [sort, setSort] = useState<"recentes" | "rapidos" | "lentos">("recentes");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setRows(new Map());
    void mapLimit(done, 4, async (title) => {
      const row = await client
        .gameTrophies("me", title)
        .then((trophies) => ({ title, ...completionSpans(trophies) }))
        .catch(() => null);
      if (alive) setRows((prev) => new Map(prev).set(title.id, row));
    });
    return () => {
      alive = false;
    };
  }, [client, key]);

  if (!done.length) return null;
  const list = [...rows.values()].filter((r): r is Row => !!r && !!(r.platinum || r.full));
  const time = (r: Row) => (r.platinum ?? r.full)!.ms;
  const sorted = [...list].sort((a, b) =>
    sort === "rapidos"
      ? time(a) - time(b)
      : sort === "lentos"
        ? time(b) - time(a)
        : Date.parse((b.full ?? b.platinum)!.end) - Date.parse((a.full ?? a.platinum)!.end),
  );
  const plats = list.map((r) => r.platinum).filter((s): s is CompletionSpan => !!s);
  const avg = plats.length ? plats.reduce((n, s) => n + s.ms, 0) / plats.length : 0;
  const fastest = plats.length ? Math.min(...plats.map((s) => s.ms)) : 0;
  const loading = rows.size < done.length;
  const shown = showAll ? sorted : sorted.slice(0, 10);

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
      <p className="text-[0.6875rem] text-muted">{t("Do primeiro troféu conquistado até a platina ou o último troféu.")}</p>

      {plats.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-[0.6875rem] text-muted">{t("Média por platina")}</p>
            <p className="font-bold">{formatSpan(avg)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-[0.6875rem] text-muted">{t("Platina mais rápida")}</p>
            <p className="font-bold">{formatSpan(fastest)}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-1">
          <p className="text-xs text-muted">
            {t("Lendo as datas dos troféus… {n} de {total} jogos", { n: rows.size, total: done.length })}
          </p>
          <ProgressBar value={(rows.size / done.length) * 100} />
        </div>
      )}

      <ul className="divide-y divide-line">
        {shown.map((r) => (
          <li key={r.title.id}>
            <Link to={`/game/me/${r.title.id}?service=${r.title.service}`} className="block py-2.5">
              <p className="truncate text-sm font-semibold">{r.title.name}</p>
              {r.platinum && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <span className="w-4 text-center">🏆</span>
                  <WithTime text={t("Platina em {time}")} time={formatSpan(r.platinum.ms)} />
                  <span className="ml-auto text-[0.6875rem] text-muted">
                    {date(r.platinum.start)} → {date(r.platinum.end)}
                  </span>
                </p>
              )}
              {r.full && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <span className="w-4 text-center">💯</span>
                  <WithTime text={t("100% em {time}")} time={formatSpan(r.full.ms)} />
                  <span className="ml-auto text-[0.6875rem] text-muted">
                    {date(r.full.start)} → {date(r.full.end)}
                  </span>
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {sorted.length > 10 && (
        <button onClick={() => setShowAll((s) => !s)} className="w-full text-sm font-semibold text-ps-blue-2">
          {showAll ? t("Mostrar menos") : t("Ver todos ({n})", { n: sorted.length })}
        </button>
      )}
    </section>
  );
}
