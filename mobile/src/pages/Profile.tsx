import { useParams } from "react-router-dom";
import { useApp } from "../app";
import { PageHeader } from "../components/PageHeader";
import { TitleList } from "../components/TitleList";
import { Avatar, ErrorBox, Spinner, TrophyBadge } from "../components/ui";
import { useData } from "../lib/useData";

export function ProfilePage() {
  const { client, signOut } = useApp();
  const { accountId = "me" } = useParams();
  const isMe = accountId === "me";

  const { data, error, loading, refresh } = useData(
    async (force) => {
      const profile = isMe ? await client.me(force) : await client.profile(accountId, force);
      // Troféus privados: a PSN recusa a lista de jogos.
      const titles = await client.titles(accountId, force).catch(() => null);
      return { profile, titles };
    },
    [client, accountId],
  );

  return (
    <>
      <PageHeader title={data?.profile.onlineId ?? "Perfil"} back={!isMe} onRefresh={refresh} refreshing={loading} />
      <div className="space-y-4 px-4 pt-4">
        {error ? <ErrorBox error={error} onRetry={refresh} /> : null}
        {loading && !data && <Spinner />}

        {data && (
          <>
            <section className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
              <Avatar src={data.profile.avatarUrl} name={data.profile.onlineId} size={72} />
              <div className="min-w-0">
                <h2 className="text-xl font-bold">
                  {data.profile.onlineId}{" "}
                  {data.profile.isPlus && <span className="text-xs font-semibold text-gold">PS Plus</span>}
                </h2>
                {data.profile.aboutMe && <p className="text-sm text-muted">{data.profile.aboutMe}</p>}
                {data.profile.earned ? (
                  <>
                    <p className="mt-1 text-sm text-muted">Nível {data.profile.level}</p>
                    <div className="mt-2 flex gap-3">
                      <TrophyBadge type="platinum" count={data.profile.earned.platinum} />
                      <TrophyBadge type="gold" count={data.profile.earned.gold} />
                      <TrophyBadge type="silver" count={data.profile.earned.silver} />
                      <TrophyBadge type="bronze" count={data.profile.earned.bronze} />
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted">Os troféus deste perfil são privados.</p>
                )}
              </div>
            </section>

            {data.titles && (
              <>
                <h3 className="font-semibold">{isMe ? "Seus jogos" : "Jogos recentes"}</h3>
                <TitleList titles={data.titles} accountId={accountId} />
              </>
            )}

            {isMe && (
              <button
                onClick={() => signOut()}
                className="w-full rounded-xl border border-line py-3 text-sm text-muted active:bg-surface"
              >
                Sair
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
