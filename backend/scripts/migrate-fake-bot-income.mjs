/**
 * 将 Fake 机器人（系统库 + 用户库）的收入字段统一为标准区间。
 *
 * 用法：cd backend && node scripts/migrate-fake-bot-income.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { normalizeIncomeRange, isStandardIncomeRange } from "../src/incomeRanges.js";

const prisma = new PrismaClient();

async function main() {
  const robots = await prisma.user.findMany({
    where: {
      OR: [
        { fakeRobotLibrary: { in: ["SYSTEM", "USER"] } },
        { phone: { startsWith: "fakem" } },
        { phone: { startsWith: "fakef" } }
      ]
    },
    select: { id: true, nickname: true, phone: true, income: true, fakeRobotLibrary: true }
  });

  let updated = 0;
  for (const user of robots) {
    const next = normalizeIncomeRange(user.income);
    if (next === user.income && isStandardIncomeRange(user.income)) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: { income: next }
    });
    console.log(`[ok] ${user.nickname} (${user.phone}) ${user.income || "—"} → ${next}`);
    updated += 1;
  }

  console.log(`\n共 ${robots.length} 个 Fake 机器人，更新 ${updated} 条。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
