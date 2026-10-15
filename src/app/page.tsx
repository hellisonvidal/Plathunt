import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getFeed, getFriendIds } from "@/lib/social";
import { ActivityCard } from "@/components/ActivityCard";
import { SyncButton } from "@/components/SyncButton";
import { TrophyBadge } from "@/components/ui";

const FILTERS = {
  todos: { label: "Tudo", types: undefined },
  platinas: { label: "Platinas", types: ["platinum"] },
  raros: { label: "Ouro e platina", types: ["gold", "platinum"] },
} as const;
type FilterKey = keyof typeof FILTERS;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string; f?: string }>;
}) {
  const user = await requireUser();
  const { before, f } = await searchParams;
  const filter: FilterKey = f && f in FILTERS ? (f as FilterKey) : "todos";

  const friendIds = await getFriendIds(user.id);
  const feed = await getFeed({
    userIds: [user.id, ...friendIds],
    viewerId: user.id,
    before: before ? new Date(before) : undefined,
    types: FILTERS[filter].types ? [...FILTERS[filter].types!] : undefined,
  });

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <p className="text-sm text-muted">Nível {user.trophyLevel}</p>
          <div className="mt-1 flex gap-3">
            <TrophyBadge type="platinum" count={user.platinum} />
            <TrophyBadge type="gold" count={user.gold} />
            <TrophyBadge type="silver" count={user.silver} />
            <TrophyBadge type="bronze" count={user.bronze} />
          </div>
        </div>
        <SyncButton />
      </section>

      <nav className="flex gap-2 text-sm">
        {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
          <Link
            key={key}
            href={key === "todos" ? "/" : `/?f=${key}`}
            className={`rounded-full px-3 py-1.5 ${
              filter === key ? "bg-ps-blue font-semibold" : "border border-line hover:border-muted"
            }`}
          >
            {FILTERS[key].label}
          </Link>
        ))}
      </nav>

      {friendIds.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          Nenhum amigo da sua lista da PSN está no Perseus ainda.{" "}
          <Link href="/friends" className="text-ps-blue-2 underline">
            Convide seus amigos
          </Link>{" "}
          para ver as conquistas deles aqui.
        </p>
      )}

      {feed.items.length === 0 ? (
        <p className="py-10 text-center text-muted">Nenhuma conquista por aqui ainda. Bora jogar! 🎮</p>
      ) : (
        <div className="space-y-4">
          {feed.items.map((item) => (
            <ActivityCard key={item.id} item={item} viewerOnlineId={user.onlineId} />
          ))}
        </div>
      )}

      {feed.nextBefore && (
        <div className="text-center">
          <Link
            href={`/?${new URLSearchParams({ ...(filter !== "todos" ? { f: filter } : {}), before: feed.nextBefore })}`}
            className="inline-block rounded-full border border-line px-4 py-2 text-sm hover:border-muted"
          >
            Carregar mais
          </Link>
        </div>
      )}
    </div>
  );
}
