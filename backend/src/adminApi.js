import { Router } from "express";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { allocateUniqueFakeBotPhone } from "./fakeBotPhone.js";
import * as oss from "./ossClient.js";

const DEFAULT_FAKE_PASSWORD = "123456";
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

function isFakeBotPhone(phone) {
  if (!phone) return false;
  return phone.startsWith("fakem") || phone.startsWith("fakef");
}

function parsePhotoUrls(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * @param {{ prisma: import("@prisma/client").PrismaClient; uploadRoot: string; getOnlineUserIds: () => string[] }} deps
 */
export function createAdminRouter(deps) {
  const { prisma, uploadRoot, getOnlineUserIds } = deps;
  const r = Router();
  /** @type {Map<string, { id: string; username: string; canManageUsers: boolean }>} */
  const adminSessions = new Map();

  function parseBearer(req) {
    const auth = String(req.headers.authorization || "");
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : "";
  }

  r.get("/health", (_req, res) => res.json({ ok: true, scope: "admin" }));

  r.post("/auth/login", async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");
      if (!username || !password) {
        return res.status(400).json({ message: "请输入用户名和密码" });
      }
      const account = await prisma.adminAccount.findUnique({ where: { username } });
      if (!account) {
        return res.status(401).json({ message: "用户名或密码错误" });
      }
      let passwordOk = false;
      try {
        passwordOk = bcrypt.compareSync(password, account.passwordHash);
      } catch (_bcryptErr) {
        console.error("[admin/auth/login] invalid passwordHash for username=", username);
        return res.status(401).json({ message: "用户名或密码错误" });
      }
      if (!passwordOk) {
        return res.status(401).json({ message: "用户名或密码错误" });
      }
      const token = randomUUID();
      adminSessions.set(token, {
        id: account.id,
        username: account.username,
        canManageUsers: account.canManageUsers
      });
      res.json({
        token,
        username: account.username,
        canManageUsers: account.canManageUsers
      });
    } catch (e) {
      console.error("[admin/auth/login]", e);
      const code = e?.code;
      const hint =
        code === "P1001" || code === "P1017"
          ? "数据库连接失败，请检查部署机网络与 MySQL 是否可达"
          : code === "P2022" || String(e?.message || "").includes("does not exist")
            ? "数据库结构未同步，请在服务器执行：cd backend && npx prisma db push && npm run seed"
            : e?.message || "登录失败，请查看服务端日志";
      res.status(500).json({ message: hint });
    }
  });

  r.post("/auth/logout", (req, res) => {
    const token = parseBearer(req);
    if (token) adminSessions.delete(token);
    res.json({ ok: true });
  });

  r.get("/auth/me", (req, res) => {
    const token = parseBearer(req);
    const session = token ? adminSessions.get(token) : null;
    if (!session) return res.status(401).json({ message: "未登录" });
    res.json({ username: session.username, canManageUsers: session.canManageUsers });
  });

  r.use((req, res, next) => {
    const token = parseBearer(req);
    if (!token || !adminSessions.has(token)) {
      return res.status(401).json({ message: "未登录或登录已失效" });
    }
    req.adminSession = adminSessions.get(token);
    next();
  });

  r.get("/users", async (req, res) => {
    try {
      if (!req.adminSession.canManageUsers) {
        return res.status(403).json({ message: "无权限访问用户管理" });
      }
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "20"), 10)));
      const q = String(req.query.q || "").trim();
      const where = q
        ? {
            OR: [
              { phone: { contains: q } },
              { nickname: { contains: q } },
              { currentCity: { contains: q } },
              { hometown: { contains: q } }
            ]
          }
        : {};
      const [total, rows] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            phone: true,
            nickname: true,
            gender: true,
            age: true,
            height: true,
            weight: true,
            hometown: true,
            currentCity: true,
            income: true,
            industry: true,
            hobbies: true,
            partnerExpectation: true,
            profileCompleted: true,
            avatarUrl: true,
            photoUrls: true,
            membershipType: true,
            membershipExpireAt: true,
            createdAt: true,
            updatedAt: true
          }
        })
      ]);
      res.json({
        total,
        page,
        pageSize,
        users: rows.map((u) => ({
          ...u,
          isFakeBot: isFakeBotPhone(u.phone),
          photoUrls: parsePhotoUrls(u.photoUrls)
        }))
      });
    } catch (e) {
      res.status(500).json({ message: e.message || "查询失败" });
    }
  });

  r.get("/online", async (_req, res) => {
    try {
      const ids = [...new Set(getOnlineUserIds().map(String))];
      if (!ids.length) return res.json({ users: [], onlineCount: 0 });
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          phone: true,
          nickname: true,
          gender: true,
          avatarUrl: true,
          currentCity: true,
          createdAt: true,
          updatedAt: true
        }
      });
      const order = new Map(ids.map((id, i) => [id, i]));
      users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      res.json({
        onlineCount: ids.length,
        users: users.map((u) => ({ ...u, isFakeBot: isFakeBotPhone(u.phone) }))
      });
    } catch (e) {
      res.status(500).json({ message: e.message || "查询失败" });
    }
  });

  r.get("/fake-bots", async (req, res) => {
    try {
      const pool = String(req.query.pool || "all").toLowerCase();
      const libFilter =
        pool === "system"
          ? { fakeRobotLibrary: "SYSTEM" }
          : pool === "user"
            ? { fakeRobotLibrary: "USER" }
            : { fakeRobotLibrary: { in: ["SYSTEM", "USER"] } };
      const users = await prisma.user.findMany({
        where: {
          AND: [
            { OR: [{ phone: { startsWith: "fakem" } }, { phone: { startsWith: "fakef" } }] },
            libFilter
          ]
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          phone: true,
          nickname: true,
          gender: true,
          age: true,
          hometown: true,
          currentCity: true,
          income: true,
          industry: true,
          hobbies: true,
          partnerExpectation: true,
          avatarUrl: true,
          photoUrls: true,
          profileCompleted: true,
          fakeRobotLibrary: true,
          createdAt: true
        }
      });
      res.json({
        users: users.map((u) => ({
          ...u,
          photoUrls: parsePhotoUrls(u.photoUrls)
        }))
      });
    } catch (e) {
      res.status(500).json({ message: e.message || "查询失败" });
    }
  });

  const createFakeSchema = z.object({
    nickname: z.string().min(1).max(64),
    gender: z.enum(["MALE", "FEMALE"]),
    age: z.coerce.number().int().min(18).max(80).default(24),
    height: z.coerce.number().int().min(140).max(210).optional(),
    weight: z.coerce.number().int().min(35).max(120).optional(),
    hometown: z.string().max(64).default(""),
    currentCity: z.string().max(64).default(""),
    income: z.string().max(32).default("8k-15k"),
    industry: z.string().max(64).default("互联网"),
    hobbies: z.string().max(512).default(""),
    partnerExpectation: z.string().max(512).default("真诚沟通，彼此尊重"),
    avatarUrl: z.string().max(2048).optional().default(""),
    photoUrls: z.array(z.string().max(2048)).optional().default([])
  });

  r.post("/fake-bots", async (req, res) => {
    try {
      const data = createFakeSchema.parse(req.body);
      const prefix = data.gender === "MALE" ? "fakem" : "fakef";
      const phone = await allocateUniqueFakeBotPhone(prisma, prefix);
      if (!phone) return res.status(500).json({ message: "无法生成唯一手机号，请重试" });

      const photos = data.photoUrls?.length
        ? data.photoUrls
        : data.avatarUrl
          ? [data.avatarUrl]
          : [`https://picsum.photos/seed/${encodeURIComponent(data.nickname)}/400/400`];

      const avatar = (data.avatarUrl && data.avatarUrl.trim()) || photos[0] || "";

      const male = data.gender === "MALE";
      const user = await prisma.user.create({
        data: {
          phone,
          password: DEFAULT_FAKE_PASSWORD,
          nickname: data.nickname.trim(),
          gender: data.gender,
          age: data.age,
          height: data.height ?? (male ? 178 : 165),
          weight: data.weight ?? (male ? 70 : 52),
          hometown: data.hometown || "杭州",
          currentCity: data.currentCity?.trim() || "",
          income: data.income,
          industry: data.industry,
          hobbies: data.hobbies || "旅行,摄影,美食",
          partnerExpectation: data.partnerExpectation || "真诚沟通，彼此尊重",
          profileCompleted: true,
          avatarUrl: avatar || null,
          photoUrls: JSON.stringify(photos),
          fakeRobotLibrary: "USER"
        }
      });
      res.status(201).json({
        user: {
          ...user,
          isFakeBot: true,
          photoUrls: parsePhotoUrls(user.photoUrls)
        }
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.issues.map((x) => x.message).join("; ") });
      }
      console.error("[admin/fake-bots POST]", e);
      const code = e?.code;
      const raw = String(e?.message || "");
      const msg =
        code === "P2000" || raw.includes("too long") || raw.includes("Data too long")
          ? "资料字段超出数据库长度（常见：相册张数多导致 photoUrls 过长）。已放宽为 TEXT，请在服务器执行：cd backend && npx prisma db push 后重试。"
          : code === "P2002"
            ? "手机号冲突，请再提交一次。"
            : raw || "创建失败";
      res.status(500).json({ message: msg });
    }
  });

  r.get("/messages", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "30"), 10)));
      const toUserId = String(req.query.toUserId || "").trim();

      const fakeUsers = await prisma.user.findMany({
        where: { fakeRobotLibrary: { in: ["SYSTEM", "USER"] } },
        select: { id: true, nickname: true, phone: true }
      });
      const fakeIds = new Set(fakeUsers.map((u) => u.id));
      if (!fakeIds.size) {
        return res.json({ total: 0, page, pageSize, messages: [], fakeBots: [] });
      }

      const where = {
        toUserId: toUserId && fakeIds.has(toUserId) ? toUserId : { in: [...fakeIds] }
      };

      const [total, messages] = await Promise.all([
        prisma.chatMessage.count({ where }),
        prisma.chatMessage.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            fromUser: {
              select: { id: true, nickname: true, phone: true, avatarUrl: true }
            },
            toUser: {
              select: { id: true, nickname: true, phone: true, avatarUrl: true }
            }
          }
        })
      ]);

      res.json({
        total,
        page,
        pageSize,
        fakeBots: fakeUsers,
        messages: messages.map((m) => ({
          id: m.id,
          kind: m.kind,
          text: m.text,
          mediaUrl: m.mediaUrl,
          audioDurationSec: m.audioDurationSec,
          readAt: m.readAt,
          createdAt: m.createdAt,
          fromUser: m.fromUser,
          toUser: m.toUser
        }))
      });
    } catch (e) {
      res.status(500).json({ message: e.message || "查询失败" });
    }
  });

  r.post("/upload", async (req, res) => {
    try {
      const { fileName, dataUrl } = req.body;
      if (!fileName || !dataUrl || !String(dataUrl).startsWith("data:")) {
        return res.status(400).json({ message: "上传参数不完整" });
      }
      const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return res.status(400).json({ message: "文件格式不正确" });
      const mimeType = match[1];
      const base64 = match[2];
      const allowedImage = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedImage.includes(mimeType)) {
        return res.status(400).json({ message: "不支持的图片格式" });
      }
      const buffer = Buffer.from(base64, "base64");
      if (buffer.byteLength > IMAGE_MAX_BYTES) {
        return res.status(400).json({ message: "图片过大，请压缩到 4MB 内" });
      }
      const ext = path.extname(String(fileName)).replace(".", "") || mimeType.split("/")[1] || "jpg";

      let gender = String(req.body?.gender || "")
        .trim()
        .toUpperCase();
      if (gender !== "MALE" && gender !== "FEMALE") gender = "FEMALE";

      if (oss.ossConfigured()) {
        try {
          const url = await oss.uploadFakeBotImageBuffer(buffer, ext, gender === "MALE" ? "MALE" : "FEMALE");
          return res.json({ url });
        } catch (e) {
          console.error("[admin/upload OSS]", e);
          return res.status(500).json({ message: e.message || "OSS 上传失败" });
        }
      }

      const dir = path.join(uploadRoot, "image");
      await fs.mkdir(dir, { recursive: true });
      const safeName = `admin-${Date.now()}-${randomUUID()}.${ext}`;
      const fullPath = path.join(dir, safeName);
      await fs.writeFile(fullPath, buffer);
      return res.json({ url: `/uploads/image/${safeName}` });
    } catch (_e) {
      return res.status(500).json({ message: "上传失败" });
    }
  });

  return r;
}
