import express from "express";
import cors from "cors";
import { z } from "zod";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { prisma } from "./prisma.js";
import {
  FRIENDLINESS_PER_ROUND,
  MALE_UNLOCK_FEE,
  MEMBERSHIP_PRICE,
  MIN_ROUNDS_FOR_UNLOCK
} from "./config.js";

const app = express();
app.use(cors());
app.use(express.json());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});
const chatStore = new Map();
const unreadStore = new Map();
const userSockets = new Map();

function getPairKey(a, b) {
  return [a, b].sort().join(":");
}

function getUnreadKey(userId, peerId) {
  return `${userId}:${peerId}`;
}

function increaseUnread(userId, peerId) {
  const key = getUnreadKey(userId, peerId);
  unreadStore.set(key, (unreadStore.get(key) || 0) + 1);
}

function resetUnread(userId, peerId) {
  unreadStore.set(getUnreadKey(userId, peerId), 0);
}

async function ensureDefaultUsers() {
  const defaults = [
    {
      phone: "13800000001",
      password: "123456",
      nickname: "星河",
      gender: "FEMALE",
      age: 25,
      height: 165,
      weight: 50,
      hometown: "成都",
      currentCity: "深圳",
      hobbies: "旅行,电影,摄影",
      partnerExpectation: "三观契合，有责任感",
      photoUrls: JSON.stringify(["https://picsum.photos/300/300?1"])
    },
    {
      phone: "13800000002",
      password: "123456",
      nickname: "阿北",
      gender: "MALE",
      age: 27,
      height: 178,
      weight: 72,
      hometown: "武汉",
      currentCity: "广州",
      hobbies: "篮球,音乐,露营",
      partnerExpectation: "善良，愿意沟通",
      photoUrls: JSON.stringify(["https://picsum.photos/300/300?2"])
    },
    {
      phone: "ellie",
      password: "123456",
      nickname: "ellie",
      gender: "FEMALE",
      age: 23,
      height: 166,
      weight: 49,
      hometown: "杭州",
      currentCity: "上海",
      hobbies: "拍照,探店,旅行",
      partnerExpectation: "温柔靠谱，有上进心",
      photoUrls: JSON.stringify(["https://picsum.photos/300/300?3"])
    }
  ];
  await Promise.all(
    defaults.map((item) =>
      prisma.user.upsert({
        where: { phone: item.phone },
        update: {},
        create: item
      })
    )
  );

  const userA = await prisma.user.findUnique({ where: { phone: "13800000001" } });
  const userB = await prisma.user.findUnique({ where: { phone: "ellie" } });
  if (userA && userB) {
    const key = getPairKey(userA.id, userB.id);
    if (!chatStore.has(key)) {
      chatStore.set(key, [
        {
          id: `m-${Date.now()}-1`,
          fromUserId: userB.id,
          toUserId: userA.id,
          text: "嗨，我是ellie，很高兴认识你~",
          createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        },
        {
          id: `m-${Date.now()}-2`,
          fromUserId: userA.id,
          toUserId: userB.id,
          text: "你好呀，周末要不要一起喝咖啡？",
          createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString()
        }
      ]);
    }
  }
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatAgo(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes}分钟前`;
  if (totalMinutes < 60 * 24) return `${Math.floor(totalMinutes / 60)}小时前`;
  return `${Math.floor(totalMinutes / (60 * 24))}天前`;
}

function createSquarePostPool(size = 5000) {
  const templates = [
    "今天工作有点累，想找个能聊得来的人。",
    "希望遇到一个三观契合的人。",
    "刚下班，来广场看看有没有同频的人。",
    "最近在学做饭，谁来分享简单菜谱。",
    "喜欢散步和听歌，想找个能一起放松的人。",
    "真诚最重要，希望互相尊重、互相理解。",
    "周末想去短途旅行，有没有推荐。",
    "想认真恋爱，不想无效社交。"
  ];

  const posts = [];
  for (let i = 1; i <= size; i += 1) {
    const gender = Math.random() > 0.5 ? "MALE" : "FEMALE";
    const minutesAgo = randInt(1, 60 * 24 * 15);
    posts.push({
      id: i,
      nickname: gender === "MALE" ? `盲盒男生${randInt(10, 999)}` : `盲盒女生${randInt(10, 999)}`,
      gender,
      text: templates[randInt(0, templates.length - 1)],
      likes: randInt(0, 999),
      minutesAgo,
      createdAt: formatAgo(minutesAgo),
      distanceKm: Number((Math.random() * (300 - 10) + 10).toFixed(1))
    });
  }
  return posts;
}

let squarePostPool = createSquarePostPool(5000).sort((a, b) => a.minutesAgo - b.minutesAgo);

const profileSchema = z.object({
  phone: z.string().min(6),
  password: z.string().min(6),
  nickname: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE"]),
  age: z.number().int().min(18).max(60),
  height: z.number().int().min(130).max(220),
  weight: z.number().int().min(30).max(200),
  hometown: z.string().min(1),
  currentCity: z.string().min(1),
  hobbies: z.string().min(1),
  partnerExpectation: z.string().min(1),
  avatarUrl: z.string().optional(),
  photoUrls: z.array(z.string().url()).min(1)
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/register", async (req, res) => {
  try {
    const data = profileSchema.parse(req.body);
    const user = await prisma.user.create({
      data: { ...data, photoUrls: JSON.stringify(data.photoUrls) }
    });
    return res.json({ user });
  } catch (error) {
    if (error?.name?.includes("PrismaClient")) {
      return res.status(503).json({ message: "数据库暂时不可用，请稍后重试" });
    }
    return res.status(400).json({ message: error.message });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await prisma.user.findFirst({ where: { phone, password } });
    if (!user) return res.status(401).json({ message: "手机号或密码错误" });
    return res.json({ user });
  } catch (error) {
    if (error?.name?.includes("PrismaClient")) {
      return res.status(503).json({ message: "数据库暂时不可用，请稍后重试" });
    }
    return res.status(500).json({ message: "登录失败，请稍后重试" });
  }
});

app.get("/square/posts", (_req, res) => {
  const limit = Math.min(Number(_req.query.limit) || 60, 200);
  const offset = Math.max(Number(_req.query.offset) || 0, 0);
  const refresh = String(_req.query.refresh || "0") === "1";

  if (refresh) {
    squarePostPool = createSquarePostPool(5000).sort((a, b) => a.minutesAgo - b.minutesAgo);
  }

  const sliced = squarePostPool.slice(offset, offset + limit);
  const posts = sliced.map(({ minutesAgo, ...rest }) => rest);
  const nextOffset = offset + posts.length;
  const hasMore = nextOffset < squarePostPool.length;

  res.json({
    posts,
    total: squarePostPool.length,
    offset,
    nextOffset,
    hasMore
  });
});

app.get("/match/online-count", (_req, res) => {
  const base = Math.floor(Math.random() * (300000 - 180000 + 1)) + 180000;
  const swing = Math.floor(Math.random() * 5001);
  const direction = Math.random() > 0.5 ? 1 : -1;
  const count = Math.max(180000, Math.min(300000, base + direction * swing));
  res.json({ count });
});

app.post("/match/start", async (req, res) => {
  const { userId } = req.body;
  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!currentUser) return res.status(404).json({ message: "用户不存在" });

  const target = await prisma.user.findFirst({
    where: {
      id: { not: currentUser.id },
      gender: currentUser.gender === "MALE" ? "FEMALE" : "MALE"
    }
  });
  if (!target) return res.status(404).json({ message: "暂时没有可匹配对象" });

  const [maleUserId, femaleUserId] =
    currentUser.gender === "MALE" ? [currentUser.id, target.id] : [target.id, currentUser.id];

  const session = await prisma.matchSession.create({ data: { maleUserId, femaleUserId } });
  return res.json({ session, targetBlindBox: { id: target.id, nickname: "盲盒用户" } });
});

app.post("/game/dice-round", async (req, res) => {
  const { sessionId } = req.body;
  const session = await prisma.matchSession.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ message: "对局不存在" });

  const diceA = Math.floor(Math.random() * 6) + 1;
  const diceB = Math.floor(Math.random() * 6) + 1;
  const questions = [
    "你最近一次心动是什么时候？",
    "你最希望另一半具备什么品质？",
    "你会因为什么瞬间决定认真恋爱？"
  ];
  const options = ["真诚最重要", "情绪稳定", "有共同成长意愿", "能一起面对现实"];

  const roundsPlayed = session.roundsPlayed + 1;
  const friendliness = Math.min(100, session.friendliness + FRIENDLINESS_PER_ROUND);
  const isUnlocked = roundsPlayed >= MIN_ROUNDS_FOR_UNLOCK && friendliness >= 100;

  const updated = await prisma.matchSession.update({
    where: { id: sessionId },
    data: { roundsPlayed, friendliness, isUnlocked }
  });

  return res.json({
    result: {
      diceA,
      diceB,
      winner: diceA >= diceB ? "A" : "B",
      question: questions[Math.floor(Math.random() * questions.length)],
      options
    },
    progress: updated
  });
});

app.post("/match/unlock", async (req, res) => {
  const { sessionId, maleUserId } = req.body;
  const session = await prisma.matchSession.findUnique({ where: { id: sessionId } });
  if (!session || session.maleUserId !== maleUserId) {
    return res.status(400).json({ message: "解锁请求无效" });
  }
  if (!session.isUnlocked) {
    return res.status(400).json({ message: "友好度未达到100或回合不足5次" });
  }
  if (session.unlockPaid) return res.json({ ok: true, amount: MALE_UNLOCK_FEE });

  await prisma.maleUnlock.create({
    data: { maleUserId: session.maleUserId, femaleUserId: session.femaleUserId, amount: MALE_UNLOCK_FEE }
  });
  await prisma.matchSession.update({ where: { id: sessionId }, data: { unlockPaid: true } });
  return res.json({ ok: true, amount: MALE_UNLOCK_FEE });
});

app.post("/membership/subscribe", async (req, res) => {
  const { userId, plan } = req.body;
  const price = MEMBERSHIP_PRICE[plan];
  if (!price) return res.status(400).json({ message: "无效会员套餐" });

  const monthsMap = { MONTH: 1, QUARTER: 3, HALF_YEAR: 6, YEAR: 12 };
  const expire = new Date();
  expire.setMonth(expire.getMonth() + monthsMap[plan]);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { membershipType: plan, membershipExpireAt: expire }
  });
  return res.json({ user, paid: price });
});

app.get("/chat/contacts", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ message: "缺少 userId" });
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) return res.status(404).json({ message: "用户不存在" });

    const contacts = await prisma.user.findMany({
      where: { id: { not: userId } },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
    return res.json({
      contacts: contacts.map((item) => ({
        id: item.id,
        name: item.nickname,
        avatar: item.avatarUrl || "https://picsum.photos/80/80?chat",
        status: `${item.currentCity} · 在线`,
        phone: item.phone
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: "拉取通讯录失败" });
  }
});

app.get("/chat/conversations", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ message: "缺少 userId" });
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) return res.status(404).json({ message: "用户不存在" });

    const contacts = await prisma.user.findMany({
      where: { id: { not: userId } },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
    const conversations = contacts.map((peer) => {
      const key = getPairKey(userId, peer.id);
      const messages = chatStore.get(key) || [];
      const last = messages[messages.length - 1];
      return {
        id: peer.id,
        name: peer.nickname,
        avatar: peer.avatarUrl || "https://picsum.photos/80/80?chat",
        preview: last?.text || "开始聊天吧",
        time: last?.createdAt || peer.updatedAt.toISOString(),
        unread: unreadStore.get(getUnreadKey(userId, peer.id)) || 0
      };
    });
    return res.json({ conversations });
  } catch (error) {
    return res.status(500).json({ message: "拉取会话失败" });
  }
});

app.get("/chat/messages", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    const peerId = String(req.query.peerId || "");
    if (!userId || !peerId) return res.status(400).json({ message: "缺少 userId 或 peerId" });
    const key = getPairKey(userId, peerId);
    return res.json({ messages: chatStore.get(key) || [] });
  } catch (error) {
    return res.status(500).json({ message: "拉取消息失败" });
  }
});

app.post("/chat/read", async (req, res) => {
  try {
    const { userId, peerId } = req.body;
    if (!userId || !peerId) return res.status(400).json({ message: "参数不完整" });
    resetUnread(String(userId), String(peerId));
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "更新已读失败" });
  }
});

app.post("/chat/messages", async (req, res) => {
  try {
    const { fromUserId, toUserId, text } = req.body;
    const content = String(text || "").trim();
    if (!fromUserId || !toUserId || !content) {
      return res.status(400).json({ message: "参数不完整" });
    }
    const key = getPairKey(String(fromUserId), String(toUserId));
    const message = {
      id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fromUserId: String(fromUserId),
      toUserId: String(toUserId),
      text: content,
      createdAt: new Date().toISOString()
    };
    const messages = chatStore.get(key) || [];
    messages.push(message);
    chatStore.set(key, messages.slice(-200));
    increaseUnread(String(toUserId), String(fromUserId));
    const targetSockets = userSockets.get(String(toUserId));
    if (targetSockets?.size) {
      targetSockets.forEach((socketId) => {
        io.to(socketId).emit("chat:message", message);
      });
    }
    return res.json({ message });
  } catch (error) {
    return res.status(500).json({ message: "发送消息失败" });
  }
});

app.get("/users/:id/profile", async (req, res) => {
  const { viewerId } = req.query;
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  const viewer = await prisma.user.findUnique({ where: { id: String(viewerId) } });
  if (!target || !viewer) {
    return res.status(404).json({ message: "用户不存在" });
  }

  const hasMembership =
    viewer.membershipType !== "FREE" &&
    viewer.membershipExpireAt &&
    viewer.membershipExpireAt > new Date();
  if (!hasMembership) {
    return res.status(403).json({ message: "开通会员后可查看资料并发起聊天" });
  }

  const safeProfile = {
    id: target.id,
    nickname: target.nickname,
    gender: target.gender,
    age: target.age,
    height: target.height,
    weight: target.weight,
    hometown: target.hometown,
    currentCity: target.currentCity,
    hobbies: target.hobbies,
    partnerExpectation: target.partnerExpectation,
    photoUrls: JSON.parse(target.photoUrls)
  };
  return res.json({ profile: safeProfile });
});

io.on("connection", (socket) => {
  const userId = String(socket.handshake.query.userId || "");
  if (!userId) {
    socket.disconnect(true);
    return;
  }
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);

  socket.on("chat:send", ({ toUserId, text }) => {
    const content = String(text || "").trim();
    if (!toUserId || !content) return;
    const message = {
      id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fromUserId: userId,
      toUserId: String(toUserId),
      text: content,
      createdAt: new Date().toISOString()
    };
    const key = getPairKey(userId, String(toUserId));
    const messages = chatStore.get(key) || [];
    messages.push(message);
    chatStore.set(key, messages.slice(-200));
    increaseUnread(String(toUserId), userId);

    socket.emit("chat:message", message);
    const targetSockets = userSockets.get(String(toUserId));
    if (targetSockets?.size) {
      targetSockets.forEach((socketId) => {
        io.to(socketId).emit("chat:message", message);
      });
    }
  });

  socket.on("disconnect", () => {
    const sockets = userSockets.get(userId);
    if (!sockets) return;
    sockets.delete(socket.id);
    if (!sockets.size) userSockets.delete(userId);
  });
});

const port = process.env.PORT || 4000;
ensureDefaultUsers()
  .catch((error) => {
    console.error("failed to ensure default users", error);
  })
  .finally(() => {
    httpServer.listen(port, () => console.log(`API running: http://localhost:${port}`));
  });
