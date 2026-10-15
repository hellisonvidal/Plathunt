-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "psnAccountId" TEXT NOT NULL,
    "onlineId" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "aboutMe" TEXT,
    "isPlus" BOOLEAN NOT NULL DEFAULT false,
    "trophyLevel" INTEGER NOT NULL DEFAULT 1,
    "trophyTier" INTEGER NOT NULL DEFAULT 1,
    "bronze" INTEGER NOT NULL DEFAULT 0,
    "silver" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "platinum" INTEGER NOT NULL DEFAULT 0,
    "accessTokenEnc" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "ownerId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("ownerId","friendId")
);

-- CreateTable
CREATE TABLE "Game" (
    "npCommunicationId" TEXT NOT NULL,
    "npServiceName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "platform" TEXT NOT NULL,
    "definedBronze" INTEGER NOT NULL DEFAULT 0,
    "definedSilver" INTEGER NOT NULL DEFAULT 0,
    "definedGold" INTEGER NOT NULL DEFAULT 0,
    "definedPlatinum" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("npCommunicationId")
);

-- CreateTable
CREATE TABLE "UserTitle" (
    "userId" TEXT NOT NULL,
    "npCommunicationId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "earnedBronze" INTEGER NOT NULL DEFAULT 0,
    "earnedSilver" INTEGER NOT NULL DEFAULT 0,
    "earnedGold" INTEGER NOT NULL DEFAULT 0,
    "earnedPlatinum" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "trophiesSyncedAt" TIMESTAMP(3),

    CONSTRAINT "UserTitle_pkey" PRIMARY KEY ("userId","npCommunicationId")
);

-- CreateTable
CREATE TABLE "Trophy" (
    "id" TEXT NOT NULL,
    "npCommunicationId" TEXT NOT NULL,
    "trophyId" INTEGER NOT NULL,
    "groupId" TEXT NOT NULL DEFAULT 'default',
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "iconUrl" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Trophy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trophyKey" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "earnedRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Congratulation" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Congratulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "emoji" TEXT,
    "message" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_psnAccountId_key" ON "User"("psnAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_onlineId_key" ON "User"("onlineId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Friendship_friendId_idx" ON "Friendship"("friendId");

-- CreateIndex
CREATE INDEX "UserTitle_userId_lastUpdatedAt_idx" ON "UserTitle"("userId", "lastUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trophy_npCommunicationId_trophyId_key" ON "Trophy"("npCommunicationId", "trophyId");

-- CreateIndex
CREATE INDEX "Activity_earnedAt_idx" ON "Activity"("earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_trophyKey_key" ON "Activity"("userId", "trophyKey");

-- CreateIndex
CREATE INDEX "Reaction_activityId_idx" ON "Reaction"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_activityId_userId_emoji_key" ON "Reaction"("activityId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "Congratulation_activityId_createdAt_idx" ON "Congratulation"("activityId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTitle" ADD CONSTRAINT "UserTitle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTitle" ADD CONSTRAINT "UserTitle_npCommunicationId_fkey" FOREIGN KEY ("npCommunicationId") REFERENCES "Game"("npCommunicationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trophy" ADD CONSTRAINT "Trophy_npCommunicationId_fkey" FOREIGN KEY ("npCommunicationId") REFERENCES "Game"("npCommunicationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_trophyKey_fkey" FOREIGN KEY ("trophyKey") REFERENCES "Trophy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Congratulation" ADD CONSTRAINT "Congratulation_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Congratulation" ADD CONSTRAINT "Congratulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
