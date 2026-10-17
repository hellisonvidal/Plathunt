import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { PsPlusIcon } from "../components/icons";
import { PageHeader } from "../components/PageHeader";
import { StatusDot } from "../components/StatusDot";
import { Avatar, ErrorBox, ProgressBar, Spinner, TrophyBadge } from "../components/ui";
import { presenceRank, presenceText } from "../lib/presence";
import { platformsOf } from "../lib/stats";
import { useData } from "../lib/useData";
import type { Presence, Profile, Title } from "../psn/types";

type Sort = "nivel" | "platinas" | "nome";
type StatusFilter = "todos" | "online" | "offline";

/** Todos os amigos da PSN: a lista vem inteira, os perfis carregam aos poucos. */
export function FriendsPage() {
  const { client } = useApp();
  const ids = useData((force) => client.friendIds(force), [client]);
  const [profiles, setProfiles] = useState<Map<string, Profile | null>>(new Map());
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("nivel");
  const [status, setStatus] = useState<StatusFilter>("todos");
  // Status online/offline de todos de uma vez (poucos pedidos à PSN).
  const presence = useData(
    async (force) => (ids.data ? client.presences(ids.data, force) : null),
    [client, ids.data],
  );
  const presences = presence.data ?? {};

  // Carrega cada perfil (o cliente limita as chamadas simultâneas) e vai mostrando.
  useEffect(() => {
    if (!ids.data) return;
    let alive = true;
    setProfiles(new Map());
    for (const id of ids.data) {
      client
        .profile(id, reloadKey > 0)
        .catch(() => null)
        .then((p) => alive && setProfiles((prev) => new Map(prev).set(id, p)));
    }
    return () => {
      alive = false;
    };
  }, [client, ids.data, reloadKey]);

  const total = ids.data?.length ?? 0;
  const done = profiles.size;
  const loaded = [...profiles.values()].filter((p): p is Profile => p !== null);
  const q = query.trim().toLowerCase();
  const onlineCount = Object.values(presences).filter((p) => p.status === "online").length;
  const visible = loaded
    .filter((p) => !q || p.onlineId.toLowerCase().includes(q))
    .filter((p) => {
      if (status === "todos") return true;
      const s = presences[p.accountId]?.status;
      return status === "online" ? s === "online" : s !== "online";
    })
    .sort((a, b) => {
      // Online sempre em cima; dentro de cada grupo, a ordem escolhida.
      const byStatus = presenceRank(presences[a.accountId]) - presenceRank(presences[b.accountId]);
      if (byStatus) return byStatus;
      if (sort === "nome") return a.onlineId.localeCompare(b.onlineId);
      if (sort === "platinas") return (b.earned?.platinum ?? -1) - (a.earned?.platinum ?? -1);
      return (b.level ?? -1) - (a.level ?? -1);
    });

  return (
    <>
      <PageHeader
        title="Amigos"
        onRefresh={() => {
          ids.refresh();
          presence.refresh();
          setReloadKey((k) => k + 1);
        }}
        refreshing={ids.loading || presence.loading || (total > 0 && done < total)}
      />
      <div className="space-y-3 px-4 pt-4">
        {ids.error ? <ErrorBox error={ids.error} onRetry={ids.refresh} /> : null}
        {ids.loading && !ids.data && <Spinner label="Carregando sua lista de amigos da PSN…" />}
        {ids.data && total === 0 && (
          <p className="py-12 text-center text-sm text-muted">Sua lista de amigos da PSN está vazia.</p>
        )}

        {total > 0 && (
          <>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar amigo"
                className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none focus:border-ps-blue-2"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Ordenar amigos"
                className="rounded-full border border-line bg-surface-2 px-3 text-sm"
              >
                <option value="nivel">Nível</option>
                <option value="platinas">Platinas</option>
                <option value="nome">Nome</option>
              </select>
            </div>

            <div className="flex gap-2 text-sm" role="radiogroup" aria-label="Status">
              {(
                [
                  ["todos", "Todos"],
                  ["online", `🟢 Online${presence.data ? ` (${onlineCount})` : ""}`],
                  ["offline", `⚪ Offline${presence.data ? ` (${total - onlineCount})` : ""}`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={status === k}
                  onClick={() => setStatus(k)}
                  className={`rounded-full px-3 py-1.5 ${status === k ? "bg-ps-blue font-semibold" : "border border-line text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted">
                {total} amigos na PSN
                {presence.data && ` · ${onlineCount} online agora`}
                {done < total && ` · carregando perfis ${done} de ${total}…`}
              </p>
              {done < total && <ProgressBar value={(done / total) * 100} />}
            </div>
          </>
        )}

        {visible.map((f) => (
          <FriendCard key={f.accountId} friend={f} presence={presences[f.accountId]} />
        ))}

        {q && visible.length === 0 && done === total && (
          <p className="py-8 text-center text-sm text-muted">Nenhum amigo com “{query}”.</p>
        )}
        {!q && status !== "todos" && visible.length === 0 && done === total && presence.data && (
          <p className="py-8 text-center text-sm text-muted">
            {status === "online" ? "Nenhum amigo online agora." : "Todos os seus amigos estão online!"}
          </p>
        )}
      </div>
    </>
  );
}

/** Diz se o elemento já apareceu na tela (vira true uma vez e fica). */
function useWhenVisible<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") return setVisible(true);
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);
  return [ref, visible];
}

function FriendCard({ friend: f, presence }: { friend: Profile; presence?: Presence }) {
  const { client } = useApp();
  const [ref, onScreen] = useWhenVisible<HTMLAnchorElement>();
  const [titles, setTitles] = useState<Title[] | null>(null);
  const [loadingTitles, setLoadingTitles] = useState(false);

  // Plataformas e nº de jogos só quando o cartão aparece (economiza chamadas à PSN).
  useEffect(() => {
    if (!onScreen || f.level === null) return;
    let alive = true;
    setLoadingTitles(true);
    client
      .recentTitles(f.accountId)
      .catch(() => null)
      .then((t) => alive && setTitles(t))
      .finally(() => alive && setLoadingTitles(false));
    return () => {
      alive = false;
    };
  }, [client, f.accountId, f.level, onScreen]);

  const platforms = titles ? platformsOf(titles) : [];

  return (
    <Link
      ref={ref}
      to={`/u/${f.accountId}`}
      className="block rounded-2xl border border-line bg-surface p-4 active:border-muted"
    >
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <Avatar src={f.avatarUrl} name={f.onlineId} size={56} />
          {presence && <StatusDot status={presence.status} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {f.onlineId}{" "}
            {f.isPlus && (
              <span className="inline-flex items-center gap-0.5 align-middle text-[0.6875rem] font-semibold text-gold">
                <PsPlusIcon size={13} /> PS Plus
              </span>
            )}
          </p>
          {f.level !== null ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs font-bold text-ps-blue-2">Nv. {f.level}</span>
              <div className="flex-1">
                <ProgressBar value={f.levelProgress ?? 0} />
              </div>
              <span className="text-[0.6875rem] text-muted">{f.levelProgress ?? 0}%</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">Troféus privados</p>
          )}
          {presence && (
            <p
              className={`mt-1 truncate text-[0.6875rem] ${presence.status === "online" ? "font-semibold text-online" : "text-muted"}`}
            >
              {presenceText(presence)}
            </p>
          )}
        </div>
      </div>

      {f.earned && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <TrophyBadge type="platinum" count={f.earned.platinum} />
          <TrophyBadge type="gold" count={f.earned.gold} />
          <TrophyBadge type="silver" count={f.earned.silver} />
          <TrophyBadge type="bronze" count={f.earned.bronze} />
        </div>
      )}

      {f.level !== null && (
        <div className="mt-3 flex min-h-5 flex-wrap items-center gap-1.5 text-[0.6875rem]">
          {platforms.map((p) => (
            <span key={p} className="rounded-full border border-line px-2 py-0.5 text-muted">
              {p}
            </span>
          ))}
          {titles && <span className="ml-auto text-muted">{titles.length >= 100 ? "100+" : titles.length} jogos</span>}
          {loadingTitles && !titles && <span className="text-muted">carregando plataformas…</span>}
        </div>
      )}
    </Link>
  );
}

