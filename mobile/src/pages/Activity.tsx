import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { ReactionBar } from "../components/Reactions";
import { Avatar, ErrorBox, RemoteImage, Spinner, TrophyBadge, rarityLabel, timeAgo } from "../components/ui";
import { useSettings } from "../lib/settings";
import { useData } from "../lib/useData";
import type { FeedItem } from "../psn/types";

const FILTERS = {
  todos: { label: "Tudo", types: null },
  amigos: { label: "Amigos", types: null },
  platinas: { label: "Platinas", types: ["platinum"] },
  raros: { label: "Ouro e platina", types: ["gold", "platinum"] },
} as const;
type FilterKey = keyof typeof FILTERS;

export function ActivityPage() {
  const { client } = useApp();
  const { feedDays } = useSettings();
  const { data, error, loading, refresh } = useData((force) => client.feed(force), [client, feedDays]);
  const [filter, setFilter] = useState<FilterKey>("todos");

  const items = (data ?? []).filter((i) => {
    if (filter === "amigos") return !i.owner.isMe;
    const types = FILTERS[filter].types as readonly string[] | null;
    return !types || types.includes(i.trophy.type);
  });

  return (
    <>
      <PageHeader title="Atividades" onRefresh={refresh} refreshing={loading} />
      <div className="space-y-4 px-4 pt-4">
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 text-sm">
          {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`shrink-0 rounded-full px-3 py-1.5 ${
                filter === k ? "bg-ps-blue font-semibold" : "border border-line text-muted"
              }`}
            >
              {FILTERS[k].label}
            </button>
          ))}
        </nav>

        {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
        {loading && !data && <Spinner label="Buscando os troféus seus e dos seus amigos…" />}

        {data && items.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">
            Nenhum troféu nos últimos {feedDays} dias por aqui. Bora jogar! 🎮
          </p>
        )}

        {items.map((item) => (
          <FeedCard key={item.key} item={item} />
        ))}

        {data && items.length > 0 && (
          <p className="pb-2 text-center text-[0.6875rem] text-muted">
            Suas curtidas ficam salvas neste celular.
          </p>
        )}
      </div>
    </>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const isPlatinum = item.trophy.type === "platinum";
  const rarity = rarityLabel(item.rate);
  const gameLink = `/game/${item.owner.isMe ? "me" : item.owner.accountId}/${item.game.id}?service=${item.game.service}`;

  return (
    <article
      className={`rounded-2xl border bg-surface p-4 ${
        isPlatinum ? "border-platinum/50 shadow-[0_0_24px_-8px] shadow-platinum/40" : "border-line"
      }`}
    >
      <header className="flex items-center gap-3">
        <Link to={item.owner.isMe ? "/" : `/u/${item.owner.accountId}`}>
          <Avatar src={item.owner.avatarUrl} name={item.owner.onlineId} />
        </Link>
        <div className="min-w-0 flex-1 text-sm">
          <p>
            <Link to={item.owner.isMe ? "/" : `/u/${item.owner.accountId}`} className="font-semibold">
              {item.owner.isMe ? "Você" : item.owner.onlineId}
            </Link>{" "}
            {isPlatinum ? "platinou" : "conquistou um troféu em"}{" "}
            <Link to={gameLink} className="font-semibold">
              {item.game.name}
            </Link>
          </p>
          <p className="text-xs text-muted">
            {timeAgo(item.earnedAt)} · {item.game.platform}
          </p>
        </div>
      </header>

      <Link to={gameLink} className="mt-3 flex gap-3 rounded-xl bg-surface-2 p-3">
        <RemoteImage src={item.trophy.iconUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg" fallback={null} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{item.trophy.name}</h3>
            <TrophyBadge type={item.trophy.type} />
          </div>
          {item.trophy.detail && <p className="mt-1 text-sm text-muted">{item.trophy.detail}</p>}
          {rarity && <p className="mt-1 text-xs text-ps-blue-2">{rarity}</p>}
        </div>
      </Link>

      <ReactionBar itemKey={item.key} />
    </article>
  );
}
