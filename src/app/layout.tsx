import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "./actions";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { Avatar } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perseus — troféus PlayStation com os amigos",
  description: "Acompanhe seus troféus da PSN, comemore as conquistas dos amigos e reaja com emojis.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user
    ? await db.notification.count({ where: { recipientId: user.id, readAt: null } })
    : 0;

  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        {user && (
          <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
            <nav className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3 text-sm">
              <Link href="/" className="mr-3 text-lg font-bold tracking-tight">
                <span className="text-ps-blue-2">◆</span> Perseus
              </Link>
              <Link href="/" className="rounded-full px-3 py-1.5 hover:bg-surface">Feed</Link>
              <Link href="/trophies" className="rounded-full px-3 py-1.5 hover:bg-surface">Meus troféus</Link>
              <Link href="/friends" className="rounded-full px-3 py-1.5 hover:bg-surface">Amigos</Link>
              <Link href="/notifications" className="relative rounded-full px-3 py-1.5 hover:bg-surface">
                🔔
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 rounded-full bg-ps-blue px-1.5 text-[10px] font-bold">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <Link href={`/u/${user.onlineId}`} className="flex items-center gap-2">
                  <Avatar src={user.avatarUrl} name={user.onlineId} size={28} />
                  <span className="hidden sm:inline">{user.onlineId}</span>
                </Link>
                <form action={logoutAction}>
                  <button className="rounded-full px-2 py-1 text-muted hover:text-ink" title="Sair">⎋</button>
                </form>
              </div>
            </nav>
          </header>
        )}
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
