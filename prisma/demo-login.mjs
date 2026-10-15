// Cria uma sessão para um usuário demo e imprime o valor do cookie.
// Uso (somente desenvolvimento): npm run demo:login -- Kratos_BR
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const db = new PrismaClient();
const onlineId = process.argv[2] ?? "Kratos_BR";

const user = await db.user.findUnique({ where: { onlineId } });
if (!user || !user.psnAccountId.startsWith("demo-")) {
  console.error(`Usuário demo "${onlineId}" não encontrado. Rode npm run db:seed antes.`);
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
await db.session.create({
  data: {
    tokenHash: createHash("sha256").update(token).digest("hex"),
    userId: user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
  },
});
await db.$disconnect();

console.log("No DevTools do navegador (Application → Cookies → http://localhost:3000), crie o cookie:");
console.log(`  perseus_session=${token}`);
