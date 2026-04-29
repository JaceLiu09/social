import express from "express";
import cors from "cors";
import { z } from "zod";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
app.use(express.json({ limit: "20mb" }));
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});
const userSockets = new Map();
const authTokens = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.join(__dirname, "../uploads");
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const AUDIO_MAX_BYTES = 8 * 1024 * 1024;

function getPairKey(a, b) {
  return [a, b].sort().join(":");
}

function normalizeFriendPair(a, b) {
  return [String(a), String(b)].sort();
}

function pairWhere(userA, userB) {
  return {
    OR: [
      { fromUserId: userA, toUserId: userB },
      { fromUserId: userB, toUserId: userA }
    ]
  };
}

function issueAuthToken(userId) {
  const token = randomUUID();
  authTokens.set(token, { userId: String(userId), issuedAt: Date.now() });
  return token;
}

function getAuthUserId(req) {
  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return "";
  const token = match[1].trim();
  const session = authTokens.get(token);
  return session?.userId || "";
}

function previewText(message) {
  if (message.kind === "IMAGE") return "[图片]";
  if (message.kind === "AUDIO") return "[语音]";
  return message.text || "";
}

function toTenDigitId(input) {
  const raw = String(input || "");
  let hash = 0n;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 131n + BigInt(raw.charCodeAt(i))) % 10000000000n;
  }
  return hash.toString().padStart(10, "0");
}

async function getFriendIds(userId) {
  const list = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }]
    }
  });
  return list.map((item) => (item.userAId === userId ? item.userBId : item.userAId));
}

const DEFAULT_PASSWORD = "123456";
const VIRTUAL_USER_COUNT = 12;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(existingPhones) {
  let phone = "";
  do {
    const suffix = String(randomInt(0, 999999999)).padStart(9, "0");
    phone = `19${suffix}`;
  } while (existingPhones.has(phone));
  existingPhones.add(phone);
  return phone;
}

function buildVirtualUser(index, existingPhones) {
  const male = index % 2 === 0;
  const hobbiesPool = male
    ? ["篮球,音乐,露营", "健身,游戏,电影", "跑步,摄影,咖啡"]
    : ["旅行,探店,摄影", "阅读,瑜伽,电影", "羽毛球,音乐,美食"];
  const cityPool = ["上海", "深圳", "广州", "杭州", "成都", "北京"];
  const hometownPool = ["南京", "武汉", "西安", "苏州", "青岛", "重庆"];
  const photoSeed = 100 + index;

  return {
    phone: randomPhone(existingPhones),
    password: DEFAULT_PASSWORD,
    nickname: `guest${String(index + 1).padStart(2, "0")}`,
    gender: male ? "MALE" : "FEMALE",
    age: randomInt(22, 30),
    height: male ? randomInt(170, 186) : randomInt(158, 172),
    weight: male ? randomInt(62, 82) : randomInt(45, 60),
    hometown: hometownPool[index % hometownPool.length],
    currentCity: cityPool[index % cityPool.length],
    income: "8k-15k",
    industry: "互联网",
    hobbies: hobbiesPool[index % hobbiesPool.length],
    partnerExpectation: "真诚沟通，三观契合",
    profileCompleted: true,
    photoUrls: JSON.stringify([`https://picsum.photos/300/300?${photoSeed}`])
  };
}

function buildNamedFriendUser(nickname, index, existingPhones) {
  const profiles = [
    { gender: "MALE", hometown: "南京", currentCity: "上海", hobbies: "跑步,电影,咖啡" },
    { gender: "MALE", hometown: "西安", currentCity: "深圳", hobbies: "健身,旅行,摄影" },
    { gender: "FEMALE", hometown: "苏州", currentCity: "杭州", hobbies: "探店,羽毛球,音乐" },
    { gender: "FEMALE", hometown: "青岛", currentCity: "北京", hobbies: "阅读,徒步,烘焙" },
    { gender: "MALE", hometown: "重庆", currentCity: "广州", hobbies: "篮球,唱歌,桌游" }
  ];
  const profile = profiles[index % profiles.length];
  return {
    phone: randomPhone(existingPhones),
    password: DEFAULT_PASSWORD,
    nickname,
    gender: profile.gender,
    age: randomInt(22, 30),
    height: profile.gender === "MALE" ? randomInt(170, 186) : randomInt(158, 172),
    weight: profile.gender === "MALE" ? randomInt(62, 82) : randomInt(45, 60),
    hometown: profile.hometown,
    currentCity: profile.currentCity,
    income: "10k-20k",
    industry: "互联网",
    hobbies: profile.hobbies,
    partnerExpectation: "真诚沟通，三观契合",
    profileCompleted: true,
    photoUrls: JSON.stringify([`https://picsum.photos/300/300?${300 + index}`])
  };
}

async function ensureDefaultUsers() {
  const defaults = [
    {
      phone: "13800000001",
      password: DEFAULT_PASSWORD,
      nickname: "星河",
      gender: "FEMALE",
      age: 25,
      height: 165,
      weight: 50,
      hometown: "成都",
      currentCity: "深圳",
      income: "15k-25k",
      industry: "互联网",
      hobbies: "旅行,电影,摄影",
      partnerExpectation: "三观契合，有责任感",
      profileCompleted: true,
      photoUrls: JSON.stringify(["https://picsum.photos/300/300?1"])
    },
    {
      phone: "13800000002",
      password: DEFAULT_PASSWORD,
      nickname: "阿北",
      gender: "MALE",
      age: 27,
      height: 178,
      weight: 72,
      hometown: "武汉",
      currentCity: "广州",
      income: "10k-20k",
      industry: "产品",
      hobbies: "篮球,音乐,露营",
      partnerExpectation: "善良，愿意沟通",
      profileCompleted: true,
      photoUrls: JSON.stringify(["https://picsum.photos/300/300?2"])
    },
    {
      phone: "13800000003",
      password: DEFAULT_PASSWORD,
      nickname: "ellie",
      gender: "FEMALE",
      age: 23,
      height: 166,
      weight: 49,
      hometown: "杭州",
      currentCity: "上海",
      income: "12k-18k",
      industry: "设计",
      hobbies: "拍照,探店,旅行",
      partnerExpectation: "温柔靠谱，有上进心",
      profileCompleted: true,
      photoUrls: JSON.stringify(["https://picsum.photos/300/300?3"])
    }
  ];
  await Promise.all(defaults.map((item) => prisma.user.upsert({ where: { phone: item.phone }, update: {}, create: item })));

  const existingUsers = await prisma.user.findMany({ select: { id: true, phone: true, nickname: true } });
  const existingPhones = new Set(existingUsers.map((u) => u.phone));
  const existingByNickname = new Set(existingUsers.map((u) => u.nickname));

  const namedFriends = ["alan", "phil", "juni", "dace", "jay"];
  const missingNamed = namedFriends.filter((nickname) => !existingByNickname.has(nickname));
  if (missingNamed.length) {
    await prisma.user.createMany({
      data: missingNamed.map((nickname, idx) => buildNamedFriendUser(nickname, idx, existingPhones)),
      skipDuplicates: true
    });
  }

  const allUsers = await prisma.user.findMany({ select: { phone: true, nickname: true } });
  const allPhones = new Set(allUsers.map((u) => u.phone));
  const existingVirtualCount = allUsers.filter((u) => u.nickname.startsWith("guest")).length;
  const missingVirtual = Math.max(0, VIRTUAL_USER_COUNT - existingVirtualCount);

  if (missingVirtual > 0) {
    const startIndex = existingVirtualCount;
    const virtualUsers = Array.from({ length: missingVirtual }, (_, idx) => buildVirtualUser(startIndex + idx, allPhones));
    await prisma.user.createMany({
      data: virtualUsers,
      skipDuplicates: true
    });
  }

  const userA = await prisma.user.findUnique({ where: { phone: "13800000001" } });
  const userB = await prisma.user.findUnique({ where: { phone: "13800000003" } });
  if (userA && userB) {
    const seededCount = await prisma.chatMessage.count({
      where: pairWhere(userA.id, userB.id)
    });
    if (seededCount === 0) {
      await prisma.chatMessage.createMany({
        data: [
          {
            fromUserId: userB.id,
            toUserId: userA.id,
            text: "嗨，我是ellie，很高兴认识你~",
            createdAt: new Date(Date.now() - 1000 * 60 * 30)
          },
          {
            fromUserId: userA.id,
            toUserId: userB.id,
            text: "你好呀，周末要不要一起喝咖啡？",
            createdAt: new Date(Date.now() - 1000 * 60 * 20)
          }
        ]
      });
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

const registerBasicSchema = z.object({
  phone: z.string().min(6),
  password: z.string().min(6),
  smsCode: z.string().length(6)
});

const completeProfileSchema = z.object({
  nickname: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE"]),
  birthDate: z.string().min(8),
  hometown: z.string().min(1),
  currentCity: z.string().min(1),
  income: z.string().min(1),
  industry: z.string().min(1),
  hobbies: z.string().min(1),
  partnerExpectation: z.string().min(1),
  avatarUrl: z.string().optional()
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/uploads", express.static(uploadRoot));

app.post("/chat/upload", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const { fileName, dataUrl, kind } = req.body;
    const mediaKind = kind === "AUDIO" ? "AUDIO" : "IMAGE";
    if (!fileName || !dataUrl || !String(dataUrl).startsWith("data:")) {
      return res.status(400).json({ message: "上传参数不完整" });
    }
    const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ message: "文件格式不正确" });
    const mimeType = match[1];
    const base64 = match[2];
    const allowedImage = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const allowedAudio = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"];
    if (mediaKind === "IMAGE" && !allowedImage.includes(mimeType)) {
      return res.status(400).json({ message: "不支持的图片格式" });
    }
    if (mediaKind === "AUDIO" && !allowedAudio.includes(mimeType)) {
      return res.status(400).json({ message: "不支持的语音格式" });
    }
    const buffer = Buffer.from(base64, "base64");
    if (mediaKind === "IMAGE" && buffer.byteLength > IMAGE_MAX_BYTES) {
      return res.status(400).json({ message: "图片过大，请压缩到 4MB 内" });
    }
    if (mediaKind === "AUDIO" && buffer.byteLength > AUDIO_MAX_BYTES) {
      return res.status(400).json({ message: "语音过大，请压缩到 8MB 内" });
    }
    const ext = path.extname(String(fileName)).replace(".", "") || mimeType.split("/")[1] || "bin";
    const folder = mediaKind === "AUDIO" ? "audio" : "image";
    const dir = path.join(uploadRoot, folder);
    await fs.mkdir(dir, { recursive: true });
    const safeName = `${Date.now()}-${randomUUID()}.${ext}`;
    const fullPath = path.join(dir, safeName);
    await fs.writeFile(fullPath, buffer);
    return res.json({ url: `/uploads/${folder}/${safeName}` });
  } catch (_error) {
    return res.status(500).json({ message: "上传失败" });
  }
});

app.post("/auth/register-basic", async (req, res) => {
  try {
    const data = registerBasicSchema.parse(req.body);
    if (String(data.smsCode) !== "123456") {
      return res.status(400).json({ message: "短信验证码错误（测试码：123456）" });
    }
    const exists = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (exists) return res.status(409).json({ message: "手机号已注册，请直接登录" });
    const nickname = `用户${data.phone.slice(-4)}`;
    const user = await prisma.user.create({
      data: {
        phone: data.phone,
        password: data.password,
        nickname,
        photoUrls: JSON.stringify([]),
        profileCompleted: false
      }
    });
    const token = issueAuthToken(user.id);
    return res.json({ user, token, needsProfile: true });
  } catch (error) {
    if (error?.name?.includes("PrismaClient")) {
      return res.status(503).json({ message: "数据库暂时不可用，请稍后重试" });
    }
    return res.status(400).json({ message: error.message });
  }
});

app.post("/auth/complete-profile", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const data = completeProfileSchema.parse(req.body);
    const birth = new Date(data.birthDate);
    if (Number.isNaN(birth.getTime())) return res.status(400).json({ message: "出生年月日格式无效" });
    const now = new Date();
    const age = Math.max(
      18,
      now.getFullYear() -
        birth.getFullYear() -
        (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
    );
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        nickname: data.nickname,
        gender: data.gender,
        birthDate: birth,
        age,
        hometown: data.hometown,
        currentCity: data.currentCity,
        income: data.income,
        industry: data.industry,
        hobbies: data.hobbies,
        partnerExpectation: data.partnerExpectation,
        avatarUrl: data.avatarUrl || null,
        profileCompleted: true
      }
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
    const token = issueAuthToken(user.id);
    return res.json({ user, token, needsProfile: !user.profileCompleted });
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
    const userId = getAuthUserId(req) || String(req.query.userId || "");
    if (!userId) return res.status(400).json({ message: "缺少 userId" });
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) return res.status(404).json({ message: "用户不存在" });
    const friendIds = await getFriendIds(userId);
    if (!friendIds.length) return res.json({ contacts: [] });

    const contacts = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
    return res.json({
      contacts: contacts.map((item) => ({
        id: item.id,
        name: item.nickname,
        avatar: item.avatarUrl || "https://picsum.photos/80/80?chat",
        status: `${item.currentCity} · 在线`
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: "拉取通讯录失败" });
  }
});

app.get("/friends/search", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const keyword = String(req.query.keyword || "").trim().toLowerCase();
    if (!keyword) return res.json({ users: [] });
    const allUsers = await prisma.user.findMany({
      where: { id: { not: userId } },
      orderBy: { updatedAt: "desc" },
      take: 5000
    });
    const friendIds = new Set(await getFriendIds(userId));
    const requests = await prisma.friendRequest.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }]
      }
    });
    const requestMap = new Map();
    requests.forEach((item) => {
      const peerId = item.fromUserId === userId ? item.toUserId : item.fromUserId;
      requestMap.set(peerId, item);
    });
    const candidates = allUsers
      .filter((u) => {
        return (
          String(u.nickname || "").toLowerCase().includes(keyword) ||
          String(u.phone || "").toLowerCase().includes(keyword) ||
          toTenDigitId(u.id).includes(keyword)
        );
      })
      .map((u) => {
        const reqItem = requestMap.get(u.id);
        return {
          id: u.id,
          uid10: toTenDigitId(u.id),
          phone: u.phone,
          name: u.nickname,
          avatar: u.avatarUrl || "",
          hometown: u.hometown,
          currentCity: u.currentCity,
          hobbies: u.hobbies,
          partnerExpectation: u.partnerExpectation,
          isFriend: friendIds.has(u.id),
          requestId: reqItem?.id || null,
          requestStatus: reqItem?.status || null,
          requestDirection: reqItem ? (reqItem.fromUserId === userId ? "OUTGOING" : "INCOMING") : null
        };
      })
      .slice(0, 80);
    return res.json({ users: candidates });
  } catch (_error) {
    return res.status(500).json({ message: "搜索好友失败" });
  }
});

app.post("/friends/requests", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const toUserId = String(req.body.toUserId || "");
    if (!toUserId || toUserId === userId) return res.status(400).json({ message: "参数无效" });

    const [a, b] = normalizeFriendPair(userId, toUserId);
    const existingFriend = await prisma.friendship.findFirst({ where: { userAId: a, userBId: b } });
    if (existingFriend) return res.status(200).json({ ok: true, message: "已是好友" });

    const reverse = await prisma.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: userId } }
    });
    if (reverse?.status === "PENDING") {
      await prisma.friendRequest.update({
        where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: userId } },
        data: { status: "ACCEPTED" }
      });
      await prisma.friendship.create({ data: { userAId: a, userBId: b } });
      return res.json({ ok: true, message: "已互加成功" });
    }

    const reqItem = await prisma.friendRequest.upsert({
      where: { fromUserId_toUserId: { fromUserId: userId, toUserId } },
      update: { status: "PENDING" },
      create: { fromUserId: userId, toUserId, status: "PENDING" }
    });
    return res.json({ ok: true, request: reqItem });
  } catch (_error) {
    return res.status(500).json({ message: "发起好友请求失败" });
  }
});

app.get("/friends/requests/incoming", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const requests = await prisma.friendRequest.findMany({
      where: { toUserId: userId, status: "PENDING" },
      include: { fromUser: true },
      orderBy: { createdAt: "desc" }
    });
    return res.json({
      requests: requests.map((r) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        name: r.fromUser.nickname,
        uid10: toTenDigitId(r.fromUser.id),
        avatar: r.fromUser.avatarUrl || "",
        currentCity: r.fromUser.currentCity
      }))
    });
  } catch (_error) {
    return res.status(500).json({ message: "拉取好友请求失败" });
  }
});

app.post("/friends/requests/:id/respond", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const action = String(req.body.action || "").toUpperCase();
    if (!["ACCEPT", "REJECT"].includes(action)) return res.status(400).json({ message: "无效操作" });
    const reqItem = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });
    if (!reqItem || reqItem.toUserId !== userId) return res.status(404).json({ message: "请求不存在" });
    if (reqItem.status !== "PENDING") return res.status(400).json({ message: "请求已处理" });

    await prisma.friendRequest.update({
      where: { id: req.params.id },
      data: { status: action === "ACCEPT" ? "ACCEPTED" : "REJECTED" }
    });
    if (action === "ACCEPT") {
      const [a, b] = normalizeFriendPair(reqItem.fromUserId, reqItem.toUserId);
      await prisma.friendship.upsert({
        where: { userAId_userBId: { userAId: a, userBId: b } },
        update: {},
        create: { userAId: a, userBId: b }
      });
    }
    return res.json({ ok: true });
  } catch (_error) {
    return res.status(500).json({ message: "处理好友请求失败" });
  }
});

app.get("/chat/conversations", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) return res.status(404).json({ message: "用户不存在" });

    // Only peers with real messages (not "every other user in DB") — avoids rows where
    // preview/time looked like another person's thread and caused confusion.
    const recent = await prisma.chatMessage.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }]
      },
      orderBy: { createdAt: "desc" },
      take: 5000
    });
    const lastByPeer = new Map();
    const peerOrder = [];
    for (const m of recent) {
      const peerId = m.fromUserId === userId ? m.toUserId : m.fromUserId;
      if (lastByPeer.has(peerId)) continue;
      lastByPeer.set(peerId, m);
      peerOrder.push(peerId);
    }

    const slice = peerOrder.slice(0, 50);
    const peers = await prisma.user.findMany({
      where: { id: { in: slice } }
    });
    const peerMap = new Map(peers.map((p) => [p.id, p]));

    const conversations = await Promise.all(
      slice.map(async (peerId) => {
        const peer = peerMap.get(peerId);
        const last = lastByPeer.get(peerId);
        if (!peer || !last) return null;
        const unread = await prisma.chatMessage.count({
          where: {
            fromUserId: peerId,
            toUserId: userId,
            readAt: null
          }
        });
        return {
          id: peer.id,
          name: peer.nickname,
          avatar: peer.avatarUrl || "https://picsum.photos/80/80?chat",
          preview: previewText(last),
          time: last.createdAt.toISOString(),
          unread
        };
      })
    );
    return res.json({ conversations: conversations.filter(Boolean) });
  } catch (error) {
    return res.status(500).json({ message: "拉取会话失败" });
  }
});

app.get("/chat/messages", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const peerId = String(req.query.peerId || "");
    if (!peerId) return res.status(400).json({ message: "缺少 peerId" });
    const messages = await prisma.chatMessage.findMany({
      where: pairWhere(userId, peerId),
      orderBy: { createdAt: "asc" },
      take: 300
    });
    return res.json({
      messages: messages.map((item) => ({
        id: item.id,
        fromUserId: item.fromUserId,
        toUserId: item.toUserId,
        kind: item.kind,
        text: item.text,
        mediaUrl: item.mediaUrl,
        audioDurationSec: item.audioDurationSec,
        createdAt: item.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: "拉取消息失败" });
  }
});

app.post("/chat/read", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const { peerId } = req.body;
    if (!peerId) return res.status(400).json({ message: "参数不完整" });
    await prisma.chatMessage.updateMany({
      where: {
        fromUserId: String(peerId),
        toUserId: String(userId),
        readAt: null
      },
      data: { readAt: new Date() }
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "更新已读失败" });
  }
});

app.post("/chat/messages", async (req, res) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ message: "未登录或登录态失效" });
    }
    const { toUserId, text, kind, mediaUrl, audioDurationSec } = req.body;
    const messageKind = ["TEXT", "IMAGE", "AUDIO"].includes(String(kind || "TEXT"))
      ? String(kind || "TEXT")
      : "TEXT";
    const content = String(text || "").trim();
    const normalizedMediaUrl = mediaUrl ? String(mediaUrl) : null;
    if (!toUserId) {
      return res.status(400).json({ message: "参数不完整" });
    }
    if (messageKind === "TEXT" && !content) return res.status(400).json({ message: "文本内容不能为空" });
    if ((messageKind === "IMAGE" || messageKind === "AUDIO") && !normalizedMediaUrl) {
      return res.status(400).json({ message: "媒体消息缺少地址" });
    }
    const message = await prisma.chatMessage.create({
      data: {
        fromUserId: authUserId,
        toUserId: String(toUserId),
        kind: messageKind,
        text: messageKind === "TEXT" ? content : "",
        mediaUrl: normalizedMediaUrl,
        audioDurationSec:
          messageKind === "AUDIO" && Number.isFinite(Number(audioDurationSec))
            ? Math.max(1, Math.floor(Number(audioDurationSec)))
            : null
      }
    });
    const payload = {
      id: message.id,
      fromUserId: authUserId,
      toUserId: String(toUserId),
      kind: message.kind,
      text: message.text,
      mediaUrl: message.mediaUrl,
      audioDurationSec: message.audioDurationSec,
      createdAt: message.createdAt.toISOString()
    };
    const targetSockets = userSockets.get(String(toUserId));
    if (targetSockets?.size) {
      targetSockets.forEach((socketId) => {
        io.to(socketId).emit("chat:message", payload);
      });
    }
    return res.json({ message: payload });
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

  socket.on("chat:send", async ({ toUserId, text, kind, mediaUrl, audioDurationSec }) => {
    const messageKind = ["TEXT", "IMAGE", "AUDIO"].includes(String(kind || "TEXT"))
      ? String(kind || "TEXT")
      : "TEXT";
    const content = String(text || "").trim();
    const normalizedMediaUrl = mediaUrl ? String(mediaUrl) : null;
    if (!toUserId) return;
    if (messageKind === "TEXT" && !content) return;
    if ((messageKind === "IMAGE" || messageKind === "AUDIO") && !normalizedMediaUrl) return;
    try {
      const message = await prisma.chatMessage.create({
        data: {
          fromUserId: userId,
          toUserId: String(toUserId),
          kind: messageKind,
          text: messageKind === "TEXT" ? content : "",
          mediaUrl: normalizedMediaUrl,
          audioDurationSec:
            messageKind === "AUDIO" && Number.isFinite(Number(audioDurationSec))
              ? Math.max(1, Math.floor(Number(audioDurationSec)))
              : null
        }
      });
      const payload = {
        id: message.id,
        fromUserId: message.fromUserId,
        toUserId: message.toUserId,
        kind: message.kind,
        text: message.text,
        mediaUrl: message.mediaUrl,
        audioDurationSec: message.audioDurationSec,
        createdAt: message.createdAt.toISOString()
      };

      socket.emit("chat:message", payload);
      const targetSockets = userSockets.get(String(toUserId));
      if (targetSockets?.size) {
        targetSockets.forEach((socketId) => {
          io.to(socketId).emit("chat:message", payload);
        });
      }
    } catch (_error) {
      socket.emit("chat:error", { message: "消息发送失败" });
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
