import "dotenv/config";
import { verifyPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"]! }) });
  const acc = await prisma.account.findFirst({ where: { user: { email: "demo@alternance.demo" } } });
  const ok = acc?.password ? await verifyPassword({ hash: acc.password, password: "Demo1234!" }) : false;
  console.log("Mot de passe démo vérifiable par better-auth :", ok);
  await prisma.$disconnect();
  if (!ok) process.exit(1);
}
main();
