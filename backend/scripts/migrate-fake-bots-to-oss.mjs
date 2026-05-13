/**
 * 将 fakem/fakef 机器人头像与相册中仍为本地 /uploads/ 的路径上传到 OSS，并写回数据库。
 *
 * 前置：配置与 test:oss 相同 OSS 环境变量；DATABASE_URL 可读。
 *
 *   cd backend && node scripts/migrate-fake-bots-to-oss.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as oss from "../src/ossClient.js";
import { prisma } from "../src/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.join(__dirname, "../uploads");

function localFileFromUploadsUrl(url) {
  const s = String(url || "").trim();
  if (!s.startsWith("/uploads/")) return null;
  const rel = s.replace(/^\/uploads\//, "");
  return path.join(uploadRoot, rel);
}

async function main() {
  if (!oss.ossConfigured()) {
    console.error("请先配置 ALIYUN_OSS_ACCESS_KEY_ID / SECRET / BUCKET / REGION（与 npm run test:oss 相同）。");
    process.exit(1);
  }

  const uploaded = new Map();

  async function migrateUrl(localUrl, gender) {
    const s = String(localUrl || "").trim();
    if (!s.startsWith("/uploads/")) return s;
    if (uploaded.has(s)) return uploaded.get(s);
    const fp = localFileFromUploadsUrl(s);
    if (!fp) return s;
    let buf;
    try {
      buf = await fs.readFile(fp);
    } catch {
      console.warn("文件不存在，跳过:", fp);
      return s;
    }
    const ext = path.extname(fp).replace(/^\./, "") || "jpg";
    const newUrl = await oss.uploadFakeBotImageBuffer(buf, ext, gender === "MALE" ? "MALE" : "FEMALE");
    uploaded.set(s, newUrl);
    return newUrl;
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [{ phone: { startsWith: "fakem" } }, { phone: { startsWith: "fakef" } }]
    },
    select: {
      id: true,
      nickname: true,
      gender: true,
      avatarUrl: true,
      photoUrls: true
    }
  });

  let updated = 0;
  for (const u of users) {
    const gender = u.gender === "MALE" ? "MALE" : "FEMALE";
    let avatarUrl = u.avatarUrl;
    let photos = [];
    try {
      const arr = JSON.parse(u.photoUrls || "[]");
      photos = Array.isArray(arr) ? arr : [];
    } catch {
      photos = [];
    }

    if (avatarUrl && String(avatarUrl).startsWith("/uploads/")) {
      avatarUrl = await migrateUrl(avatarUrl, gender);
    }

    const newPhotos = [];
    for (const p of photos) {
      if (typeof p === "string" && p.startsWith("/uploads/")) {
        newPhotos.push(await migrateUrl(p, gender));
      } else {
        newPhotos.push(p);
      }
    }

    const avatarChanged = avatarUrl !== u.avatarUrl;
    const photosChanged = JSON.stringify(newPhotos) !== JSON.stringify(photos);

    if (avatarChanged || photosChanged) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          avatarUrl: avatarUrl || null,
          photoUrls: JSON.stringify(newPhotos)
        }
      });
      console.log("已更新:", u.nickname, u.id);
      updated++;
    }
  }

  console.log(`完成。共检查 ${users.length} 个 Fake 用户，更新 ${updated} 条。`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
