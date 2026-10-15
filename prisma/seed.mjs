// Dados de demonstração para desenvolver a interface sem uma conta PSN.
// Uso: npm run db:seed  (depois: npm run demo:login -- <onlineId>)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const FAR_FUTURE = new Date("2100-01-01");
const PLACEHOLDER = "demo.demo.demo"; // tokens falsos: usuários demo não sincronizam com a PSN

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000);

async function main() {
  await db.$transaction([
    db.notification.deleteMany(),
    db.reaction.deleteMany(),
    db.congratulation.deleteMany(),
    db.activity.deleteMany(),
    db.trophy.deleteMany(),
    db.userTitle.deleteMany(),
    db.game.deleteMany(),
    db.friendship.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany({ where: { psnAccountId: { startsWith: "demo-" } } }),
  ]);

  const mk = (i, onlineId, level, counts) =>
    db.user.create({
      data: {
        psnAccountId: `demo-${i}`,
        onlineId,
        trophyLevel: level,
        trophyTier: Math.min(10, Math.ceil(level / 100)),
        ...counts,
        accessTokenEnc: PLACEHOLDER,
        accessExpiresAt: FAR_FUTURE,
        refreshTokenEnc: PLACEHOLDER,
        refreshExpiresAt: FAR_FUTURE,
        lastSyncedAt: FAR_FUTURE,
      },
    });

  const me = await mk(1, "Kratos_BR", 412, { platinum: 23, gold: 180, silver: 520, bronze: 1900 });
  const aloy = await mk(2, "Aloy_Hunter", 538, { platinum: 41, gold: 260, silver: 700, bronze: 2500 });
  const ellie = await mk(3, "Ellie_TLOU", 233, { platinum: 9, gold: 70, silver: 210, bronze: 800 });

  for (const [a, b] of [[me, aloy], [me, ellie], [aloy, ellie]]) {
    await db.friendship.createMany({
      data: [
        { ownerId: a.id, friendId: b.id },
        { ownerId: b.id, friendId: a.id },
      ],
    });
  }

  const games = [
    { id: "NPWR_DEMO_GOW", name: "God of War Ragnarök", platform: "PS5", counts: [1, 6, 12, 17] },
    { id: "NPWR_DEMO_HFW", name: "Horizon Forbidden West", platform: "PS5", counts: [1, 4, 13, 47] },
    { id: "NPWR_DEMO_TLOU", name: "The Last of Us Part II", platform: "PS4", counts: [1, 3, 12, 14] },
  ];
  for (const g of games) {
    await db.game.create({
      data: {
        npCommunicationId: g.id,
        npServiceName: g.platform === "PS5" ? "trophy2" : "trophy",
        name: g.name,
        platform: g.platform,
        definedPlatinum: g.counts[0],
        definedGold: g.counts[1],
        definedSilver: g.counts[2],
        definedBronze: g.counts[3],
      },
    });
  }

  const trophies = [
    ["NPWR_DEMO_GOW", 0, "platinum", "Pai e Filho", "Obtenha todos os troféus"],
    ["NPWR_DEMO_GOW", 12, "gold", "Rainha das Valquírias", "Derrote Gná"],
    ["NPWR_DEMO_GOW", 5, "bronze", "Primeiros passos", "Conclua o prólogo"],
    ["NPWR_DEMO_HFW", 0, "platinum", "Lenda de Horizon", "Obtenha todos os troféus"],
    ["NPWR_DEMO_HFW", 22, "silver", "Domadora de Máquinas", "Sobrescreva 20 tipos de máquinas"],
    ["NPWR_DEMO_TLOU", 7, "gold", "Sobrevivente", "Conclua o jogo no modo Sobrevivente"],
  ];
  for (const [game, tid, type, name, detail] of trophies) {
    await db.trophy.create({
      data: { id: `${game}:${tid}`, npCommunicationId: game, trophyId: tid, type, name, detail },
    });
  }

  const titles = [
    [me, "NPWR_DEMO_GOW", 100, [1, 6, 12, 17], 2],
    [me, "NPWR_DEMO_TLOU", 64, [0, 1, 7, 10], 30],
    [aloy, "NPWR_DEMO_HFW", 100, [1, 4, 13, 47], 1],
    [aloy, "NPWR_DEMO_GOW", 41, [0, 1, 4, 9], 50],
    [ellie, "NPWR_DEMO_TLOU", 88, [0, 3, 10, 12], 5],
  ];
  for (const [u, game, progress, [p, g, s, b], h] of titles) {
    await db.userTitle.create({
      data: {
        userId: u.id,
        npCommunicationId: game,
        progress,
        earnedPlatinum: p,
        earnedGold: g,
        earnedSilver: s,
        earnedBronze: b,
        lastUpdatedAt: hoursAgo(h),
        trophiesSyncedAt: hoursAgo(h),
      },
    });
  }

  const act = (u, key, h, rate) =>
    db.activity.create({ data: { userId: u.id, trophyKey: key, earnedAt: hoursAgo(h), earnedRate: rate } });

  const aloyPlat = await act(aloy, "NPWR_DEMO_HFW:0", 1, 3.2);
  const myPlat = await act(me, "NPWR_DEMO_GOW:0", 2, 6.8);
  const ellieGold = await act(ellie, "NPWR_DEMO_TLOU:7", 5, 11.4);
  await act(aloy, "NPWR_DEMO_HFW:22", 26, 34.9);
  await act(me, "NPWR_DEMO_GOW:12", 28, 21.0);
  await act(aloy, "NPWR_DEMO_GOW:5", 50, 96.1);

  const react = async (activity, owner, user, emoji) => {
    await db.reaction.create({ data: { activityId: activity.id, userId: user.id, emoji } });
    if (owner.id !== user.id) {
      await db.notification.create({
        data: { recipientId: owner.id, actorId: user.id, kind: "reaction", activityId: activity.id, emoji },
      });
    }
  };
  const congrats = async (activity, owner, user, message) => {
    await db.congratulation.create({ data: { activityId: activity.id, userId: user.id, message } });
    await db.notification.create({
      data: { recipientId: owner.id, actorId: user.id, kind: "congrats", activityId: activity.id, message },
    });
  };

  await react(aloyPlat, aloy, ellie, "🔥");
  await react(aloyPlat, aloy, ellie, "🏆");
  await congrats(aloyPlat, aloy, ellie, "Platinou! Que monstro! 🏆");
  await react(myPlat, me, aloy, "👏");
  await react(myPlat, me, ellie, "👏");
  await react(myPlat, me, ellie, "🎉");
  await congrats(myPlat, me, aloy, "Ragnarök platinado, lenda! Agora bora pro Valhalla 😂");
  await react(ellieGold, ellie, aloy, "😮");

  console.log("Seed concluído: Kratos_BR, Aloy_Hunter, Ellie_TLOU");
}

main().finally(() => db.$disconnect());
