import { Router } from "express";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { allocateUniqueFakeBotPhone } from "./fakeBotPhone.js";
import * as oss from "./ossClient.js";
import { normalizeIncomeRange } from "./incomeRanges.js";

const DEFAULT_FAKE_PASSWORD = "123456";
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

function formatZodMessage(error) {
  if (!(error instanceof z.ZodError)) return error?.message || "参数错误";
  const issue = error.issues[0];
  if (!issue) return "参数错误";
  const field = String(issue.path?.[0] || "");
  if (field === "height") return "身高请填写 140–210 之间的整数（单位 cm）";
  if (field === "weight") return "体重请填写 35–120 之间的整数（单位 kg）";
  if (field === "age") return "年龄请填写 18–80 之间的整数";
  return issue.message || "参数错误";
}

function isFakeBotPhone(phone) {
  if (!phone) return false;
  return phone.startsWith("fakem") || phone.startsWith("fakef");
}

function isFakeBotUser(user) {
  if (!user) return false;
  return (
    isFakeBotPhone(user.phone) ||
    user.fakeRobotLibrary === "SYSTEM" ||
    user.fakeRobotLibrary === "USER"
  );
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

/** 与 `server.js` 中广场发帖校验一致，避免写入任意外链 */
function isAllowedSquareMediaUrl(u) {
  const s = String(u || "").trim();
  if (!s) return false;
  if (s.startsWith("/uploads/") || s.startsWith("/oss-media/")) return true;
  if (s.startsWith("/avatars/")) return true;
  try {
    const x = new URL(s);
    const p = x.pathname;
    return (
      p.includes("/uploads/") ||
      p.includes("/oss-media/") ||
      p.includes("/fake-pictures/") ||
      p.includes("/chat-history-pictures/") ||
      p.includes("/zhenren-pictures/")
    );
  } catch {
    return false;
  }
}

const adminSquareMomentPostSchema = z
  .object({
    text: z.string().max(2000).optional().default(""),
    imageUrls: z.array(z.string().max(2048)).max(9).optional().default([])
  })
  .refine((d) => String(d.text || "").trim().length > 0 || (d.imageUrls && d.imageUrls.length > 0), {
    message: "至少填写文字或上传一张图片"
  });

const adminMessageReplySchema = z.object({
  botUserId: z.string().min(1),
  toUserId: z.string().min(1),
  text: z.string().min(1).max(2000)
});

/**
 * @param {{
 *   prisma: import("@prisma/client").PrismaClient;
 *   uploadRoot: string;
 *   getOnlineUserIds: () => string[];
 *   emitChatMessage?: (toUserId: string, payload: object) => void;
 *   createImpersonationCode?: (userId: string) => string;
 *   getPublicSiteUrl?: () => string;
 * }} deps
 */
export function createAdminRouter(deps) {
  const { prisma, uploadRoot, getOnlineUserIds, emitChatMessage, createImpersonationCode, getPublicSiteUrl } =
    deps;
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
      const sort = String(req.query.sort || "createdAt").trim();
      const libFilter =
        pool === "system"
          ? { fakeRobotLibrary: "SYSTEM" }
          : pool === "user"
            ? { fakeRobotLibrary: "USER" }
            : { fakeRobotLibrary: { in: ["SYSTEM", "USER"] } };
      const orderBy =
        sort === "moments_desc"
          ? { squareMoments: { _count: "desc" } }
          : sort === "moments_asc"
            ? { squareMoments: { _count: "asc" } }
            : { createdAt: "desc" };
      const users = await prisma.user.findMany({
        where: {
          AND: [
            { OR: [{ phone: { startsWith: "fakem" } }, { phone: { startsWith: "fakef" } }] },
            libFilter
          ]
        },
        orderBy,
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
          createdAt: true,
          _count: { select: { squareMoments: true } }
        }
      });
      res.json({
        users: users.map((u) => ({
          ...u,
          momentCount: u._count?.squareMoments ?? 0,
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
    income: z.string().max(32).default("5000-1万"),
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
          income: normalizeIncomeRange(data.income),
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
        return res.status(400).json({ message: formatZodMessage(e) });
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

  /**
   * 代「用户机器人库」账号发布广场动态（写入 SquareMoment，广场 / 该用户「我的动态」一致）
   */
  const updateFakeSchema = createFakeSchema.partial();

  r.patch("/fake-bots/:userId", async (req, res) => {
    try {
      const userId = String(req.params.userId || "").trim();
      if (!userId) return res.status(400).json({ message: "用户 ID 无效" });

      const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true, fakeRobotLibrary: true }
      });
      if (!existing) return res.status(404).json({ message: "用户不存在" });
      if (!isFakeBotUser(existing)) {
        return res.status(400).json({ message: "仅支持编辑 Fake 机器人账号" });
      }

      const data = updateFakeSchema.parse(req.body || {});
      const patch = {};
      if (data.nickname !== undefined) patch.nickname = data.nickname.trim();
      if (data.age !== undefined) patch.age = data.age;
      if (data.height !== undefined) patch.height = data.height;
      if (data.weight !== undefined) patch.weight = data.weight;
      if (data.hometown !== undefined) patch.hometown = data.hometown;
      if (data.currentCity !== undefined) patch.currentCity = data.currentCity;
      if (data.income !== undefined) patch.income = normalizeIncomeRange(data.income);
      if (data.industry !== undefined) patch.industry = data.industry;
      if (data.hobbies !== undefined) patch.hobbies = data.hobbies;
      if (data.partnerExpectation !== undefined) patch.partnerExpectation = data.partnerExpectation;
      if (data.avatarUrl !== undefined) patch.avatarUrl = data.avatarUrl.trim() || null;
      if (data.photoUrls !== undefined) patch.photoUrls = JSON.stringify(data.photoUrls);
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ message: "没有可更新的字段" });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: patch,
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
          avatarUrl: true,
          photoUrls: true,
          profileCompleted: true,
          fakeRobotLibrary: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { squareMoments: true } }
        }
      });
      res.json({
        user: {
          ...user,
          isFakeBot: true,
          photoUrls: parsePhotoUrls(user.photoUrls)
        }
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: formatZodMessage(e) });
      }
      res.status(500).json({ message: e.message || "更新失败" });
    }
  });

  r.post("/fake-bots/:userId/impersonate", async (req, res) => {
    try {
      const userId = String(req.params.userId || "").trim();
      if (!userId) return res.status(400).json({ message: "用户 ID 无效" });
      if (!createImpersonationCode) {
        return res.status(503).json({ message: "登录盲盒功能未启用" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true, nickname: true, fakeRobotLibrary: true }
      });
      if (!user) return res.status(404).json({ message: "用户不存在" });
      if (!isFakeBotUser(user)) {
        return res.status(400).json({ message: "仅支持 Fake 机器人账号登录盲盒" });
      }

      const code = createImpersonationCode(user.id);
      const site = getPublicSiteUrl?.() || "";
      const url = site ? `${site}/me?asUser=${encodeURIComponent(code)}` : null;
      res.json({
        code,
        url,
        user: { id: user.id, nickname: user.nickname, phone: user.phone }
      });
    } catch (e) {
      res.status(500).json({ message: e.message || "生成登录链接失败" });
    }
  });

  r.get("/fake-bots/:userId", async (req, res) => {
    try {
      const userId = String(req.params.userId || "").trim();
      if (!userId) return res.status(400).json({ message: "用户 ID 无效" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
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
          avatarUrl: true,
          photoUrls: true,
          profileCompleted: true,
          fakeRobotLibrary: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { squareMoments: true } }
        }
      });
      if (!user) return res.status(404).json({ message: "用户不存在" });
      if (!isFakeBotUser(user)) {
        return res.status(400).json({ message: "仅支持查看 Fake 机器人账号" });
      }
      res.json({
        user: {
          ...user,
          isFakeBot: true,
          photoUrls: parsePhotoUrls(user.photoUrls)
        }
      });
    } catch (e) {
      res.status(500).json({ message: e.message || "查询失败" });
    }
  });

  r.post("/fake-bots/:userId/square-moments", async (req, res) => {
    try {
      const userId = String(req.params.userId || "").trim();
      if (!userId) return res.status(400).json({ message: "用户 ID 无效" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true, fakeRobotLibrary: true }
      });
      if (!user) return res.status(404).json({ message: "用户不存在" });
      if (!isFakeBotPhone(user.phone)) {
        return res.status(400).json({ message: "仅支持 fake 机器人账号" });
      }
      if (user.fakeRobotLibrary !== "USER") {
        return res.status(403).json({ message: "仅「用户机器人库」账号可由后台代发动态" });
      }

      const parsed = adminSquareMomentPostSchema.parse(req.body);
      const text = String(parsed.text || "").trim();
      const urls = (parsed.imageUrls || []).map((x) => String(x).trim()).filter(Boolean);
      for (const u of urls) {
        if (!isAllowedSquareMediaUrl(u)) {
          return res.status(400).json({ message: "包含不允许的图片地址" });
        }
      }

      const row = await prisma.squareMoment.create({
        data: {
          userId: user.id,
          text,
          imageUrls: JSON.stringify(urls)
        }
      });

      res.status(201).json({ ok: true, moment: { id: row.id, createdAt: row.createdAt } });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.issues[0]?.message || "参数错误" });
      }
      console.error("[admin/fake-bots/:userId/square-moments]", e);
      res.status(500).json({ message: e.message || "发布失败" });
    }
  });

  const membershipPlanLabel = {
    MONTH: "月卡",
    QUARTER: "季卡",
    HALF_YEAR: "半年卡",
    YEAR: "年卡"
  };
  const membershipStatusLabel = {
    PENDING: "待支付",
    PAID: "已支付",
    FAILED: "已取消/失败"
  };
  const paymentChannelLabel = {
    WECHAT: "微信支付",
    ALIPAY: "支付宝"
  };

  r.get("/membership-orders", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "30"), 10)));
      const status = String(req.query.status || "").trim().toUpperCase();
      const where = status && ["PENDING", "PAID", "FAILED"].includes(status) ? { status } : {};
      const [total, rows] = await Promise.all([
        prisma.membershipOrder.count({ where }),
        prisma.membershipOrder.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            user: {
              select: { id: true, nickname: true, phone: true, membershipType: true, membershipExpireAt: true }
            }
          }
        })
      ]);
      res.json({
        total,
        page,
        pageSize,
        orders: rows.map((row) => ({
          id: row.id,
          userId: row.userId,
          plan: row.plan,
          planLabel: membershipPlanLabel[row.plan] || row.plan,
          paymentChannel: row.paymentChannel,
          paymentChannelLabel: paymentChannelLabel[row.paymentChannel] || row.paymentChannel,
          amount: row.amount,
          status: row.status,
          statusLabel: membershipStatusLabel[row.status] || row.status,
          paidAt: row.paidAt,
          createdAt: row.createdAt,
          user: row.user
        }))
      });
    } catch (e) {
      res.status(500).json({ message: e.message || "查询会员订单失败" });
    }
  });

  function previewTextForMessage(m) {
    if (m.kind === "IMAGE") return "[图片]";
    if (m.kind === "AUDIO") return "[语音]";
    return String(m.text || "").trim();
  }

  function buildFakeBotConversations(messages, fakeIds, filterBotId = "") {
    const convMap = new Map();
    const userCache = new Map();

    const rememberUser = (u) => {
      if (!u?.id) return;
      userCache.set(u.id, u);
    };

    for (const m of messages) {
      rememberUser(m.fromUser);
      rememberUser(m.toUser);

      let botId = "";
      let peerId = "";
      if (fakeIds.has(m.toUserId)) {
        botId = m.toUserId;
        peerId = m.fromUserId;
      } else if (fakeIds.has(m.fromUserId)) {
        botId = m.fromUserId;
        peerId = m.toUserId;
      } else {
        continue;
      }
      if (!botId || !peerId || botId === peerId) continue;
      if (filterBotId && botId !== filterBotId) continue;

      const key = `${botId}:${peerId}`;
      const existing = convMap.get(key);
      if (!existing) {
        convMap.set(key, {
          botUserId: botId,
          peerUserId: peerId,
          messageCount: 1,
          lastMessage: m,
          lastAt: m.createdAt
        });
      } else {
        existing.messageCount += 1;
      }
    }

    return Array.from(convMap.values())
      .map((item) => ({
        botUserId: item.botUserId,
        peerUserId: item.peerUserId,
        botUser: userCache.get(item.botUserId) || null,
        peerUser: userCache.get(item.peerUserId) || null,
        messageCount: item.messageCount,
        lastAt: item.lastAt,
        lastPreview: previewTextForMessage(item.lastMessage),
        lastKind: item.lastMessage.kind
      }))
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }

  r.get("/messages/thread", async (req, res) => {
    try {
      const botUserId = String(req.query.botUserId || "").trim();
      const peerUserId = String(req.query.peerUserId || "").trim();
      if (!botUserId || !peerUserId) {
        return res.status(400).json({ message: "缺少 botUserId 或 peerUserId" });
      }

      const bot = await prisma.user.findUnique({
        where: { id: botUserId },
        select: { id: true, nickname: true, phone: true, fakeRobotLibrary: true }
      });
      if (!bot || !isFakeBotUser(bot)) {
        return res.status(400).json({ message: "无效的 Fake 机器人账号" });
      }

      const peer = await prisma.user.findUnique({
        where: { id: peerUserId },
        select: { id: true, nickname: true, phone: true, avatarUrl: true }
      });
      if (!peer) return res.status(404).json({ message: "用户不存在" });

      const messages = await prisma.chatMessage.findMany({
        where: {
          OR: [
            { fromUserId: botUserId, toUserId: peerUserId },
            { fromUserId: peerUserId, toUserId: botUserId }
          ]
        },
        orderBy: { createdAt: "asc" },
        take: 500
      });

      res.json({
        bot,
        peer,
        messages: messages.map((m) => ({
          id: m.id,
          kind: m.kind,
          text: m.text,
          mediaUrl: m.mediaUrl,
          audioDurationSec: m.audioDurationSec,
          fromUserId: m.fromUserId,
          toUserId: m.toUserId,
          createdAt: m.createdAt
        }))
      });
    } catch (e) {
      res.status(500).json({ message: e.message || "拉取会话失败" });
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
        return res.json({ total: 0, page, pageSize, conversations: [], fakeBots: [] });
      }

      const messages = await prisma.chatMessage.findMany({
        where: {
          OR: [{ toUserId: { in: [...fakeIds] } }, { fromUserId: { in: [...fakeIds] } }]
        },
        orderBy: { createdAt: "desc" },
        take: 8000,
        include: {
          fromUser: {
            select: { id: true, nickname: true, phone: true, avatarUrl: true }
          },
          toUser: {
            select: { id: true, nickname: true, phone: true, avatarUrl: true }
          }
        }
      });

      const allConversations = buildFakeBotConversations(
        messages,
        fakeIds,
        toUserId && fakeIds.has(toUserId) ? toUserId : ""
      );
      const total = allConversations.length;
      const slice = allConversations.slice((page - 1) * pageSize, page * pageSize);

      res.json({
        total,
        page,
        pageSize,
        fakeBots: fakeUsers,
        conversations: slice
      });
    } catch (e) {
      res.status(500).json({ message: e.message || "查询失败" });
    }
  });

  r.post("/messages/reply", async (req, res) => {
    try {
      const parsed = adminMessageReplySchema.parse(req.body);
      const bot = await prisma.user.findUnique({
        where: { id: parsed.botUserId },
        select: { id: true, phone: true, nickname: true, fakeRobotLibrary: true }
      });
      if (!bot || !isFakeBotUser(bot)) {
        return res.status(400).json({ message: "无效的 Fake 机器人账号" });
      }

      const peer = await prisma.user.findUnique({
        where: { id: parsed.toUserId },
        select: { id: true, nickname: true }
      });
      if (!peer) return res.status(404).json({ message: "接收用户不存在" });
      if (peer.id === bot.id) return res.status(400).json({ message: "不能回复给自己" });

      const message = await prisma.chatMessage.create({
        data: {
          fromUserId: bot.id,
          toUserId: peer.id,
          kind: "TEXT",
          text: parsed.text.trim()
        }
      });

      const payload = {
        id: message.id,
        fromUserId: bot.id,
        toUserId: peer.id,
        kind: message.kind,
        text: message.text,
        mediaUrl: null,
        thumbMediaUrl: null,
        audioDurationSec: null,
        createdAt: message.createdAt.toISOString()
      };
      emitChatMessage?.(peer.id, payload);

      res.status(201).json({
        ok: true,
        message: payload,
        bot,
        peer
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.issues[0]?.message || "参数错误" });
      }
      res.status(500).json({ message: e.message || "回复失败" });
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
          return res.status(500).json({ message: oss.humanizeOssError(e) });
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
