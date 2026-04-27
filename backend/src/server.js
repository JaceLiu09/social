import express from "express";
import cors from "cors";
import { z } from "zod";
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

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running: http://localhost:${port}`));
