"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { extractNpsso } from "@/lib/npsso";
import { PsnReauthRequired, signInWithNpsso } from "@/lib/psn";
import { createSession, destroySession, requireUser } from "@/lib/session";
import { canInteract } from "@/lib/social";
import { CONGRATS_MAX_LENGTH, isReactionEmoji } from "@/lib/social-constants";
import { syncUser } from "@/lib/sync";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const npsso = extractNpsso(String(form.get("npsso") ?? ""));
  if (!npsso) {
    return { error: "Isso não parece um código NPSSO válido. Cole o texto inteiro mostrado pela Sony." };
  }

  try {
    const user = await signInWithNpsso(npsso);
    await createSession(user.id);
    // Primeira sincronização já no login; falhas aqui não impedem a entrada.
    await syncUser(user, { force: true }).catch((err) => console.error("sync inicial falhou", err));
  } catch (err) {
    console.error("login PSN falhou", err);
    return {
      error:
        "A PSN recusou o código. Ele pode ter expirado: faça login de novo em playstation.com e copie um código novo.",
    };
  }
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function syncAction(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  try {
    const r = await syncUser(user, { force: true });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Sincronizado: ${r.titles} jogos, ${r.newTrophies} troféus novos, ${r.friends} amigos no Perseus.`,
    };
  } catch (err) {
    if (err instanceof PsnReauthRequired) {
      await destroySession();
      redirect("/login?expired=1");
    }
    console.error("sync falhou", err);
    return { ok: false, message: "Não foi possível falar com a PSN agora. Tente de novo em instantes." };
  }
}

async function loadActivityFor(viewerId: string, activityId: string) {
  const activity = await db.activity.findUnique({ where: { id: activityId }, select: { id: true, userId: true } });
  if (!activity || !(await canInteract(viewerId, activity.userId))) {
    throw new Error("Conquista não encontrada.");
  }
  return activity;
}

export async function toggleReactionAction(activityId: string, emoji: string) {
  const user = await requireUser();
  if (!isReactionEmoji(emoji)) throw new Error("Emoji inválido.");
  const activity = await loadActivityFor(user.id, activityId);

  const key = { activityId_userId_emoji: { activityId, userId: user.id, emoji } };
  const existing = await db.reaction.findUnique({ where: key });
  if (existing) {
    await db.reaction.delete({ where: key });
  } else {
    await db.reaction.create({ data: { activityId, userId: user.id, emoji } });
    if (activity.userId !== user.id) {
      await db.notification.create({
        data: { recipientId: activity.userId, actorId: user.id, kind: "reaction", activityId, emoji },
      });
    }
  }
  revalidatePath("/", "layout");
}

const congratsSchema = z.string().trim().min(1).max(CONGRATS_MAX_LENGTH);

export async function congratulateAction(activityId: string, message: string) {
  const user = await requireUser();
  const text = congratsSchema.parse(message);
  const activity = await loadActivityFor(user.id, activityId);

  await db.congratulation.create({ data: { activityId, userId: user.id, message: text } });
  if (activity.userId !== user.id) {
    await db.notification.create({
      data: { recipientId: activity.userId, actorId: user.id, kind: "congrats", activityId, message: text },
    });
  }
  revalidatePath("/", "layout");
}

export async function deleteCongratulationAction(congratsId: string) {
  const user = await requireUser();
  await db.congratulation.deleteMany({ where: { id: congratsId, userId: user.id } });
  revalidatePath("/", "layout");
}

export async function markNotificationsReadAction() {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
