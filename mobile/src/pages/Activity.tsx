import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app";
import { MeritsView } from "../components/Merits";
import { PageHeader } from "../components/PageHeader";
import { ReactionBar } from "../components/Reactions";
import { Avatar, ErrorBox, GameIcon, RemoteImage, Spinner, TrophyBadge, rarityLabel, timeAgo } from "../components/ui";
import { groupFeed, type FeedGroup } from "../lib/feed";
import { useSettings } from "../lib/settings";
import { useData } from "../lib/useData";
import type { FeedItem } from "../psn/types";

const FILTERS = {
  todos: { label: "Tudo", types: null },
  platinas: { label: "Platinas", types: ["platinum"] },
} as const;
type FilterKey = keyof typeof FILTERS;

export function ActivityPage() {
  const { client } = useApp();
  const { feedDays } = useSettings();
  const { data, error, loading, refresh } = useData((force) => client.feed(force), [client, feedDays]);
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [view, setView] = useState<"feed" | "merits">("feed");

  const items = (data ?? []).filter((i) => {
    const types = FILTERS[filter].types as readonly string[] | null;
    return !types || types.includes(i.trophy.type);
  });
  const groups = groupFeed(items);

  return (
    <>
      <PageHeader
        title="Atividades"
        onRefresh={view === "feed" ? refresh : undefined}
        refreshing={view === "feed" && loading}
      />
      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1 text-sm" role="tablist">
          {(
            [
              ["feed", "🎮 Conquistas"],
              ["merits", "🏅 Méritos"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`rounded-xl py-2 font-semibold ${view === key ? "bg-ps-blue" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "merits" ? (
          <MeritsView />
        ) : (
          <>
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

            {groups.map((group) => (
              <GroupCard key={group.key} group={group} />
            ))}

            {data && items.length > 0 && (
              <p className="pb-2 text-center text-[0.6875rem] text-muted">
                Suas curtidas ficam salvas neste celular.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Quantos troféus aparecem antes do "ver mais". */
const PREVIEW = 3;
const TYPE_ORDER = ["platinum", "gold", "silver", "bronze"] as const;

/** Um cartão por jogador, jogo e dia, com os troféus conquistados agrupados. */
function GroupCard({ group }: { group: FeedGroup }) {
  const [expanded, setExpanded] = useState(false);
  const { owner, game, items, counts } = group;
  const hasPlatinum = counts.platinum > 0;
  const profileLink = owner.isMe ? "/" : `/u/${owner.accountId}`;
  const gameLink = `/game/${owner.isMe ? "me" : owner.accountId}/${game.id}?service=${game.service}`;
  const shown = expanded ? items : items.slice(0, PREVIEW);
  const total = items.length;
  const verb = hasPlatinum ? "platinou" : total === 1 ? "conquistou 1 troféu em" : `conquistou ${total} troféus em`;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-surface ${
        hasPlatinum ? "border-platinum/50 shadow-[0_0_24px_-8px] shadow-platinum/40" : "border-line"
      }`}
    >
      <header className="flex items-center gap-3 p-4 pb-3">
        <Link to={profileLink} className="shrink-0">
          <Avatar src={owner.avatarUrl} name={owner.onlineId} size={44} />
        </Link>
        <div className="min-w-0 flex-1 text-sm">
          <p className="leading-snug">
            <Link to={profileLink} className="font-semibold">
              {owner.isMe ? "Você" : owner.onlineId}
            </Link>{" "}
            <span className="text-muted">{verb}</span>{" "}
            <Link to={gameLink} className="font-semibold">
              {game.name}
            </Link>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {timeAgo(group.latest)} · {game.platform}
          </p>
        </div>
        <Link to={gameLink} className="shrink-0">
          <GameIcon src={game.iconUrl} size={44} />
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3">
        {TYPE_ORDER.filter((t) => counts[t] > 0).map((t) => (
          <TrophyBadge key={t} type={t} count={counts[t]} />
        ))}
      </div>

      <ul className="mx-4 divide-y divide-line overflow-hidden rounded-xl bg-surface-2">
        {shown.map((item) => (
          <TrophyLine key={item.key} item={item} gameLink={gameLink} />
        ))}
      </ul>
      {total > PREVIEW && (
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mx-4 mt-2 w-[calc(100%-2rem)] rounded-xl py-2 text-sm font-semibold text-ps-blue-2 active:bg-surface-2"
        >
          {expanded ? "Mostrar menos" : `Ver mais ${total - PREVIEW} ${total - PREVIEW === 1 ? "troféu" : "troféus"}`}
        </button>
      )}

      <div className="px-4 pb-4">
        <ReactionBar itemKey={group.key} />
      </div>
    </article>
  );
}

function TrophyLine({ item, gameLink }: { item: FeedItem; gameLink: string }) {
  const rarity = rarityLabel(item.rate);
  const isPlatinum = item.trophy.type === "platinum";
  return (
    <li>
      <Link to={gameLink} className="flex items-center gap-3 p-3">
        <RemoteImage src={item.trophy.iconUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg" fallback={null} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`truncate text-sm font-semibold ${isPlatinum ? "text-platinum" : ""}`}>{item.trophy.name}</h3>
            <TrophyBadge type={item.trophy.type} />
          </div>
          {item.trophy.detail && <p className="line-clamp-2 text-xs text-muted">{item.trophy.detail}</p>}
          {rarity && <p className="text-[0.6875rem] text-ps-blue-2">{rarity}</p>}
        </div>
      </Link>
    </li>
  );
}
