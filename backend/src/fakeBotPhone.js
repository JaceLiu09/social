/**
 * 系统种子机器人与后台「用户机器人库」共用同一套手机号格式，全局依赖 User.phone 唯一约束防冲突。
 * 格式：prefix 为 fakem（男）或 fakef（女） + 8 位数字（0–99999999），与 ensureDefaultUsers / buildFakeBotUser 一致。
 */

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 生成随机候选号（不查库；批量种子时用内存 Set 去重） */
export function randomFakeBotPhoneDigits(prefix) {
  const suffix = String(randomInt(0, 99999999)).padStart(8, "0");
  return `${prefix}${suffix}`;
}

export function isFakeBotPhone(phone) {
  const p = String(phone || "");
  return p.startsWith("fakem") || p.startsWith("fakef");
}

/**
 * 后台录入机器人：逐条查库直到唯一（系统库与用户库共用命名空间，不会与种子号冲突）
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {"fakem"|"fakef"} prefix
 */
export async function allocateUniqueFakeBotPhone(prisma, prefix, maxAttempts = 200) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = randomFakeBotPhoneDigits(prefix);
    const exists = await prisma.user.findUnique({ where: { phone: candidate } });
    if (!exists) return candidate;
  }
  return null;
}
