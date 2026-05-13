/**
 * 把前端仓库里的 frontend/public/avatars/{male,female} 批量上传到 OSS，
 * 对象键：fake-pictures/seed-avatars/{male|female}/{文件名}
 *
 * 上传完成后，App / 后台会通过 resolveAssetUrl / mediaUrl 把 /avatars/... 转到
 * GET /oss-media/fake-pictures/seed-avatars/...（私有桶走服务端 AK 读）。
 *
 * 在「本机且已配置 OSS 环境变量」的目录执行：
 *
 *   cd backend && npm run upload:seed-avatars-oss
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as oss from "../src/ossClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarsRoot = path.join(__dirname, "../../frontend/public/avatars");

function mimeForFile(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

async function uploadFolder(sub) {
  const dir = path.join(avatarsRoot, sub);
  let names;
  try {
    names = await fs.readdir(dir);
  } catch (e) {
    console.warn("跳过目录（不存在或不可读）:", dir, e.message);
    return 0;
  }
  let n = 0;
  for (const name of names) {
    if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(name)) continue;
    const fp = path.join(dir, name);
    const stat = await fs.stat(fp);
    if (!stat.isFile()) continue;
    const buf = await fs.readFile(fp);
    const key = `fake-pictures/seed-avatars/${sub}/${name}`;
    await oss.putObject(buf, key, mimeForFile(name));
    n += 1;
    console.log(key);
  }
  return n;
}

async function main() {
  if (!oss.ossConfigured()) {
    console.error("请先配置 ALIYUN_OSS_ACCESS_KEY_ID / SECRET / BUCKET / REGION（与 npm run test:oss 相同）。");
    process.exit(1);
  }

  let total = 0;
  total += await uploadFolder("male");
  total += await uploadFolder("female");
  console.log(`\n完成：共上传 ${total} 个文件到 fake-pictures/seed-avatars/`);
  console.log("前端仍使用 avatarManifest 里的 /avatars/... 路径；运行时会被解析为 API /oss-media/...");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
