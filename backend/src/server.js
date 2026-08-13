import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { prisma } from "./prisma.js";
import { randomInt, randomFakeBotPhoneDigits, isFakeBotPhone } from "./fakeBotPhone.js";
import { createAdminRouter } from "./adminApi.js";
import * as oss from "./ossClient.js";
import { sampleTacitQuestionsForRound, normalizeTacitTopic, getTacitTopicLabel } from "./tacitQuestionBank.js";
import {
  COIN_PACKAGES,
  COIN_YUAN_RATE,
  DEFAULT_GIFTS,
  FRIENDLINESS_PER_ROUND,
  MALE_UNLOCK_FEE,
  MEMBERSHIP_PRICE,
  MIN_ROUNDS_FOR_UNLOCK,
  POINT_MEMBERSHIP_REDEEM
} from "./config.js";
import { prepareChatTextContent } from "./sensitiveWords.js";
import { walletSnapshot } from "./wealthLevel.js";
import { code2Session, isWechatMpConfigured } from "./wechatMp.js";
import {
  isWechatPayConfigured,
  createJsapiPrepay,
  buildOutTradeNo,
  parseWechatPayNotify,
  queryTransactionByOutTradeNo
} from "./wechatPay.js";
import {
  applyCharmGain,
  applyCoinRecharge,
  applyCoinSpend,
  redeemPointsMembership
} from "./pointsService.js";
import { normalizeIncomeRange } from "./incomeRanges.js";

const app = express();
app.use(cors());
/** CDN 勿缓存 JSON API，避免头像 URL 等更新后仍返回旧内容 */
app.use((req, res, next) => {
  if (req.path.startsWith("/assets/") || req.path === "/" || /\.[a-z0-9]+$/i.test(req.path)) {
    return next();
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "20mb" }));
app.use(async (req, _res, next) => {
  try {
    const auth = String(req.headers.authorization || "");
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) {
      await hydrateAuthTokenFromDb(match[1].trim());
    }
  } catch (_error) {
    // ignore token hydration errors
  }
  next();
});
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});
const userSockets = new Map();
const authTokens = new Map();
const impersonationCodes = new Map();
const IMPERSONATION_TTL_MS = 5 * 60 * 1000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.join(__dirname, "../uploads");
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** 聊天图片：写原图并尝试缩略图（sharp 动态加载；旧系统/无 glibc 时跳过，避免进程启动即崩） */
async function saveChatImageWithThumb(buffer, folder, safeName) {
  const dir = path.join(uploadRoot, folder);
  const thumbDir = path.join(dir, "thumb");
  await fs.mkdir(thumbDir, { recursive: true });
  const fullPath = path.join(dir, safeName);
  await fs.writeFile(fullPath, buffer);
  const mainUrl = `/uploads/${folder}/${safeName}`;
  try {
    const { default: sharp } = await import("sharp");
    const thumbBuf = await sharp(buffer)
      .rotate()
      .resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    const stem = path.parse(safeName).name;
    const thumbFile = `thumb-${stem}.jpg`;
    await fs.writeFile(path.join(thumbDir, thumbFile), thumbBuf);
    return { url: mainUrl, thumbUrl: `/uploads/${folder}/thumb/${thumbFile}` };
  } catch (_e) {
    return { url: mainUrl, thumbUrl: mainUrl };
  }
}
const AUDIO_MAX_BYTES = 8 * 1024 * 1024;
const tacitBotAnswerTimers = new Map();
const werewolfGames = new Map();
const werewolfGameTimers = new Map();
const WEREWOLF_ROLE_CONFIG = {
  6: { wolf: 2, seer: 1, witch: 0, hunter: 1, idiot: 0, villager: 2 },
  7: { wolf: 2, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 2 },
  8: { wolf: 3, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 2 },
  9: { wolf: 3, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 3 },
  10: { wolf: 3, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 4 },
  11: { wolf: 4, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 4 },
  12: { wolf: 4, seer: 1, witch: 1, hunter: 1, idiot: 1, villager: 4 }
};

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

async function persistAuthToken(userId, token) {
  const uid = String(userId);
  await prisma.authSession
    .create({
      data: {
        token,
        userId: uid
      }
    })
    .catch(() => null);
}

async function issueAuthTokenPersisted(userId) {
  const token = issueAuthToken(userId);
  await persistAuthToken(userId, token);
  return token;
}

async function hydrateAuthTokenFromDb(token) {
  if (!token || authTokens.has(token)) return;
  const row = await prisma.authSession.findUnique({
    where: { token },
    select: { userId: true, issuedAt: true }
  });
  if (row) {
    authTokens.set(token, { userId: row.userId, issuedAt: row.issuedAt.getTime() });
  }
}

function createImpersonationCode(userId) {
  const code = randomUUID();
  impersonationCodes.set(code, {
    userId: String(userId),
    expiresAt: Date.now() + IMPERSONATION_TTL_MS
  });
  return code;
}

function consumeImpersonationCode(code) {
  const entry = impersonationCodes.get(String(code || ""));
  if (!entry || entry.expiresAt < Date.now()) {
    impersonationCodes.delete(String(code || ""));
    return null;
  }
  impersonationCodes.delete(String(code || ""));
  return entry.userId;
}

function getPublicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
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

async function getFollowStatus(userId, peerId) {
  const [myFollow, theirFollow, friendIds] = await Promise.all([
    prisma.userFollow.findUnique({
      where: { followerId_followeeId: { followerId: userId, followeeId: peerId } }
    }),
    prisma.userFollow.findUnique({
      where: { followerId_followeeId: { followerId: peerId, followeeId: userId } }
    }),
    getFriendIds(userId)
  ]);
  const iFollow = Boolean(myFollow);
  const followsMe = Boolean(theirFollow);
  const mutualFollow = iFollow && followsMe;
  const isFriend = friendIds.includes(peerId);
  return { iFollow, followsMe, mutualFollow, isFriend };
}

async function syncFriendshipFromFollows(userId, peerId) {
  const status = await getFollowStatus(userId, peerId);
  const [a, b] = normalizeFriendPair(userId, peerId);
  if (status.mutualFollow) {
    await prisma.friendship.upsert({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      update: {},
      create: { userAId: a, userBId: b }
    });
    return { ...status, isFriend: true };
  }
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userAId: a, userBId: b },
        { userAId: b, userBId: a }
      ]
    }
  });
  return { ...status, isFriend: false };
}

function randomPick(list) {
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function buildWerewolfRoleDeck(playerCount) {
  const count = Math.max(6, Math.min(12, Number(playerCount) || 6));
  const cfg = WEREWOLF_ROLE_CONFIG[count] || WEREWOLF_ROLE_CONFIG[6];
  const deck = [];
  for (let i = 0; i < Number(cfg.wolf || 0); i += 1) deck.push("WOLF");
  for (let i = 0; i < Number(cfg.seer || 0); i += 1) deck.push("SEER");
  for (let i = 0; i < Number(cfg.witch || 0); i += 1) deck.push("WITCH");
  for (let i = 0; i < Number(cfg.hunter || 0); i += 1) deck.push("HUNTER");
  for (let i = 0; i < Number(cfg.idiot || 0); i += 1) deck.push("IDIOT");
  for (let i = 0; i < Number(cfg.villager || 0); i += 1) deck.push("VILLAGER");
  return shuffleList(deck);
}

function shuffleList(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildWerewolfLog(game, text) {
  return {
    id: randomUUID(),
    day: game.day,
    phase: game.phase,
    text,
    at: new Date().toISOString()
  };
}

function checkWerewolfWinner(game) {
  const aliveWolves = game.players.filter((p) => p.alive && p.camp === "WOLF").length;
  const aliveGood = game.players.filter((p) => p.alive && p.camp === "GOOD").length;
  if (aliveWolves <= 0) return "GOOD";
  if (aliveWolves >= aliveGood) return "WOLF";
  return "";
}

function getWerewolfGameView(game, viewerUserId = "") {
  const viewer = game.players.find((p) => p.userId === viewerUserId) || null;
  const alivePlayers = game.players.filter((p) => p.alive);
  const canNightKill =
    game.phase === "NIGHT" &&
    viewer?.alive &&
    viewer?.role === "WOLF" &&
    !game.nightKillTargetUserId &&
    !game.winner;
  const canSpeak = game.phase === "DAY_SPEECH" && viewer?.alive && game.currentSpeakerUserId === viewerUserId && !game.winner;
  const canVote = game.phase === "DAY_VOTE" && viewer?.alive && !game.votes[viewerUserId] && !game.winner;
  return {
    status: game.winner ? "ENDED" : "IN_GAME",
    phase: game.phase,
    day: game.day,
    winner: game.winner || "",
    currentSpeakerUserId: game.currentSpeakerUserId || "",
    speechDeadlineAt: game.speechDeadlineAt || 0,
    speechSecondsLeft: getWerewolfSpeechSecondsLeft(game),
    myRole: viewer?.role || "",
    aliveCount: alivePlayers.length,
    players: game.players.map((p) => ({
      userId: p.userId,
      name: p.name,
      alive: p.alive,
      isBot: p.isBot,
      camp: game.winner || !p.alive ? p.camp : "",
      role: game.winner || p.userId === viewerUserId || !p.alive ? p.role : "",
      votedTo: game.winner ? game.votes[p.userId] || "" : "",
      speaking: game.phase === "DAY_SPEECH" && game.currentSpeakerUserId === p.userId
    })),
    logs: game.logs.slice(-12),
    actions: {
      canNightKill,
      canSpeak,
      canVote,
      allowedTargets: alivePlayers.filter((p) => p.userId !== viewerUserId).map((p) => ({ userId: p.userId, name: p.name }))
    }
  };
}

async function getWerewolfRoomPayload(roomId, viewerUserId = "") {
  const room = await prisma.werewolfRoom.findUnique({
    where: { id: roomId },
    include: {
      members: {
        include: { user: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!room) return null;
  const acceptedCount = room.members.filter((m) => m.status === "ACCEPTED" || m.status === "HOST").length;
  const status =
    room.status === "IN_GAME" || room.status === "CLOSED"
      ? room.status
      : acceptedCount >= room.minStartPlayers
        ? "READY"
        : "WAITING";
  if (status !== room.status) {
    await prisma.werewolfRoom.update({ where: { id: room.id }, data: { status } });
    room.status = status;
  }
  return {
    id: room.id,
    type: room.type,
    status: room.status,
    ownerUserId: room.ownerUserId,
    maxSeats: room.maxSeats,
    minStartPlayers: room.minStartPlayers,
    acceptedCount,
    members: room.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.nickname,
      avatar: normalizeAvatarUrl(m.user.avatarUrl),
      status: m.status,
      invitedByUserId: m.invitedByUserId
    })),
    game: werewolfGames.has(room.id) ? getWerewolfGameView(werewolfGames.get(room.id), viewerUserId) : null
  };
}

function emitWerewolfRoomUpdateToUsers(userIds, payload) {
  userIds.forEach((uid) => {
    const sockets = userSockets.get(String(uid));
    if (!sockets?.size) return;
    sockets.forEach((socketId) => io.to(socketId).emit("werewolf:room:update", payload));
  });
}

function clearWerewolfGameTimer(roomId) {
  const timer = werewolfGameTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    werewolfGameTimers.delete(roomId);
  }
}

function getWerewolfSpeechSecondsLeft(game) {
  if (!game?.speechDeadlineAt) return 0;
  return Math.max(0, Math.ceil((Number(game.speechDeadlineAt) - Date.now()) / 1000));
}

function setWerewolfCurrentSpeaker(game, speakerUserId) {
  game.currentSpeakerUserId = speakerUserId || "";
  game.speechDeadlineAt = speakerUserId ? Date.now() + 20000 : 0;
}

function advanceWerewolfSpeaker(game) {
  game.currentSpeakerIndex += 1;
  const nextSpeaker = game.currentSpeakerOrder[game.currentSpeakerIndex] || "";
  setWerewolfCurrentSpeaker(game, nextSpeaker);
}

async function emitWerewolfGameUpdate(roomId) {
  const room = await getWerewolfRoomPayload(roomId);
  if (!room) return;
  const targets = room.members.map((m) => m.userId);
  await Promise.all(
    targets.map(async (uid) => {
      const sockets = userSockets.get(String(uid));
      if (!sockets?.size) return;
      const payload = await getWerewolfRoomPayload(roomId, uid);
      if (!payload) return;
      sockets.forEach((socketId) => io.to(socketId).emit("werewolf:room:update", payload));
    })
  );
}

async function startWerewolfGame(roomId, userId) {
  const room = await prisma.werewolfRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    return { ok: false, status: 404, message: "房间不存在" };
  }
  if (room.type === "FRIEND" && room.ownerUserId !== userId) {
    return { ok: false, status: 403, message: "仅房主可开局" };
  }
  const payload = await getWerewolfRoomPayload(roomId, userId);
  if (!payload) {
    return { ok: false, status: 404, message: "房间不存在" };
  }
  if (payload.game?.status === "IN_GAME") {
    return { ok: true, room: payload };
  }

  let acceptedMembers = payload.members.filter((m) => m.status === "HOST" || m.status === "ACCEPTED");
  let players = acceptedMembers.map((m) => ({
    userId: m.userId,
    name: m.name || "玩家",
    isBot: m.userId !== userId
  }));
  if (room.type === "MATCH") {
    const participantIds = players.map((p) => p.userId);
    const needBots = Math.max(0, 6 - participantIds.length);
    if (needBots > 0) {
      const botUsers = await prisma.user.findMany({
        where: {
          phone: { startsWith: "fake" },
          id: { notIn: participantIds }
        },
        take: needBots
      });
      players = [
        ...players,
        ...botUsers.map((u) => ({
          userId: u.id,
          name: u.nickname || "机器人",
          isBot: true
        }))
      ];
    }
    players = players.slice(0, 6);
    if (players.length < 6) {
      return { ok: false, status: 400, message: "匹配玩家不足，稍后再试" };
    }
  } else {
    if (players.length < 6) {
      return { ok: false, status: 400, message: "至少6名玩家同意后才能开始" };
    }
    players = players.slice(0, 12);
    acceptedMembers = acceptedMembers.slice(0, 12);
  }

  const roleDeck = buildWerewolfRoleDeck(players.length);
  const game = {
    roomId,
    humanUserId: userId,
    phase: "NIGHT",
    day: 1,
    winner: "",
    players: players.map((p, idx) => ({
      userId: p.userId,
      name: p.name,
      isBot: p.isBot,
      alive: true,
      role: roleDeck[idx] || "VILLAGER",
      camp: (roleDeck[idx] || "VILLAGER") === "WOLF" ? "WOLF" : "GOOD"
    })),
    logs: [],
    currentSpeakerOrder: [],
    currentSpeakerIndex: 0,
    currentSpeakerUserId: "",
    speechDeadlineAt: 0,
    nightKillTargetUserId: "",
    votes: {}
  };
  game.logs.push(buildWerewolfLog(game, "游戏开始，天黑请闭眼。"));
  werewolfGames.set(roomId, game);
  await prisma.werewolfRoom.update({ where: { id: roomId }, data: { status: "IN_GAME" } });
  await emitWerewolfGameUpdate(roomId);
  scheduleWerewolfSimulation(roomId).catch(() => {});
  const next = await getWerewolfRoomPayload(roomId, userId);
  return { ok: true, room: next };
}

async function scheduleWerewolfSimulation(roomId) {
  clearWerewolfGameTimer(roomId);
  const game = werewolfGames.get(roomId);
  if (!game || game.winner) return;

  const finishWinner = checkWerewolfWinner(game);
  if (finishWinner) {
    game.winner = finishWinner;
    game.phase = "ENDED";
    game.logs.push(buildWerewolfLog(game, finishWinner === "WOLF" ? "狼人阵营获胜。" : "好人阵营获胜。"));
    await emitWerewolfGameUpdate(roomId);
    return;
  }

  if (game.phase === "NIGHT") {
    const me = game.players.find((p) => p.userId === game.humanUserId);
    const wolves = game.players.filter((p) => p.alive && p.role === "WOLF");
    const goodTargets = game.players.filter((p) => p.alive && p.camp === "GOOD");
    if (!wolves.length || !goodTargets.length) {
      await emitWerewolfGameUpdate(roomId);
      return;
    }
    if (me?.alive && me.role === "WOLF" && !game.nightKillTargetUserId) {
      await emitWerewolfGameUpdate(roomId);
      return;
    }
    const timer = setTimeout(async () => {
      // 首夜平安夜，保证首日所有玩家都能参与发言/投票
      if (game.day === 1) {
        game.logs.push(buildWerewolfLog(game, "夜晚结束，昨夜平安无事。"));
      } else {
        const target =
          game.nightKillTargetUserId && goodTargets.some((p) => p.userId === game.nightKillTargetUserId)
            ? game.players.find((p) => p.userId === game.nightKillTargetUserId)
            : randomPick(goodTargets);
        if (target) {
          target.alive = false;
          game.logs.push(buildWerewolfLog(game, `夜晚结束，${target.name} 出局。`));
        }
      }
      game.nightKillTargetUserId = "";
      game.phase = "DAY_SPEECH";
      const aliveUserIds = game.players.filter((p) => p.alive).map((p) => p.userId);
      if (aliveUserIds.includes(game.humanUserId)) {
        game.currentSpeakerOrder = [game.humanUserId, ...shuffleList(aliveUserIds.filter((id) => id !== game.humanUserId))];
      } else {
        game.currentSpeakerOrder = shuffleList(aliveUserIds);
      }
      game.currentSpeakerIndex = 0;
      setWerewolfCurrentSpeaker(game, game.currentSpeakerOrder[0] || "");
      game.logs.push(buildWerewolfLog(game, `第 ${game.day} 天白天开始，请依次发言。`));
      await emitWerewolfGameUpdate(roomId);
      await scheduleWerewolfSimulation(roomId);
    }, 1400);
    werewolfGameTimers.set(roomId, timer);
    return;
  }

  if (game.phase === "DAY_SPEECH") {
    if (!game.currentSpeakerOrder.length || game.currentSpeakerIndex >= game.currentSpeakerOrder.length) {
      game.phase = "DAY_VOTE";
      setWerewolfCurrentSpeaker(game, "");
      game.votes = {};
      game.logs.push(buildWerewolfLog(game, "发言结束，进入公投环节。"));
      await emitWerewolfGameUpdate(roomId);
      await scheduleWerewolfSimulation(roomId);
      return;
    }
    const currentSpeaker = game.currentSpeakerOrder[game.currentSpeakerIndex];
    setWerewolfCurrentSpeaker(game, currentSpeaker);
    if (currentSpeaker === game.humanUserId) {
      await emitWerewolfGameUpdate(roomId);
      const timer = setTimeout(async () => {
        if (game.phase !== "DAY_SPEECH" || game.currentSpeakerUserId !== currentSpeaker) return;
        const speaker = game.players.find((p) => p.userId === currentSpeaker);
        if (speaker?.alive) {
          game.logs.push(buildWerewolfLog(game, `${speaker.name} 发言超时，自动过麦。`));
        }
        advanceWerewolfSpeaker(game);
        await emitWerewolfGameUpdate(roomId);
        await scheduleWerewolfSimulation(roomId);
      }, 20000);
      werewolfGameTimers.set(roomId, timer);
      return;
    }
    const timer = setTimeout(async () => {
      const speaker = game.players.find((p) => p.userId === currentSpeaker);
      if (speaker?.alive) {
        const snippets = ["我先观察一下。", "我这轮是好人视角。", "先听后面玩家发言。", "这轮发言偏保守。"];
        game.logs.push(buildWerewolfLog(game, `${speaker.name} 发言：${randomPick(snippets)}`));
      }
      advanceWerewolfSpeaker(game);
      await emitWerewolfGameUpdate(roomId);
      await scheduleWerewolfSimulation(roomId);
    }, randomInt(10000, 15000));
    werewolfGameTimers.set(roomId, timer);
    return;
  }

  if (game.phase === "DAY_VOTE") {
    const alive = game.players.filter((p) => p.alive);
    const humanAlive = alive.some((p) => p.userId === game.humanUserId);
    if (humanAlive && !game.votes[game.humanUserId]) {
      await emitWerewolfGameUpdate(roomId);
      return;
    }
    const bots = alive.filter((p) => p.userId !== game.humanUserId);
    const pendingBot = bots.find((p) => !game.votes[p.userId]);
    if (pendingBot) {
      const timer = setTimeout(async () => {
        const target = randomPick(alive.filter((p) => p.userId !== pendingBot.userId));
        if (target) game.votes[pendingBot.userId] = target.userId;
        await emitWerewolfGameUpdate(roomId);
        await scheduleWerewolfSimulation(roomId);
      }, 900);
      werewolfGameTimers.set(roomId, timer);
      return;
    }
    const tally = new Map();
    Object.values(game.votes).forEach((targetId) => tally.set(targetId, (tally.get(targetId) || 0) + 1));
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const topVote = ranked[0]?.[1] || 0;
    const topTargets = ranked.filter((item) => item[1] === topVote).map((item) => item[0]);
    const outId = randomPick(topTargets);
    const outPlayer = game.players.find((p) => p.userId === outId);
    if (outPlayer) {
      outPlayer.alive = false;
      game.logs.push(buildWerewolfLog(game, `白天公投结果：${outPlayer.name} 出局。`));
    }
    game.votes = {};
    const winner = checkWerewolfWinner(game);
    if (winner) {
      game.winner = winner;
      game.phase = "ENDED";
      game.logs.push(buildWerewolfLog(game, winner === "WOLF" ? "狼人阵营获胜。" : "好人阵营获胜。"));
      await emitWerewolfGameUpdate(roomId);
      return;
    }
    game.day += 1;
    game.phase = "NIGHT";
    setWerewolfCurrentSpeaker(game, "");
    game.logs.push(buildWerewolfLog(game, `第 ${game.day} 夜开始，狼人请选择目标。`));
    await emitWerewolfGameUpdate(roomId);
    await scheduleWerewolfSimulation(roomId);
  }
}

async function seedTacitQuestionsIfMissing(roomId) {
  const exists = await prisma.tacitQuestion.count({ where: { roomId } });
  if (exists > 0) return;
  const room = await prisma.tacitRoom.findUnique({
    where: { id: roomId },
    select: { topicCategory: true }
  });
  const questions = sampleTacitQuestionsForRound({
    topicCategory: room?.topicCategory || "social",
    count: 10
  });
  await prisma.tacitQuestion.createMany({
    data: questions.map((item, idx) => ({
      roomId,
      sortOrder: idx,
      prompt: item.prompt,
      optionA: item.optionA,
      optionB: item.optionB
    }))
  });
}

function getTacitBotDelayMs(userId, createdAt) {
  const seed = String(userId || "") + String(new Date(createdAt).getTime());
  const hash = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return 3000 + (hash % 12001);
}

async function completeTacitMatchWithBotIfNeeded(userId) {
  const queueEntry = await prisma.tacitMatchQueue.findUnique({ where: { userId } });
  if (!queueEntry) return null;
  const matchAtMs = new Date(queueEntry.createdAt).getTime() + getTacitBotDelayMs(userId, queueEntry.createdAt);
  if (Date.now() < matchAtMs) return null;

  const matchRoomMember = await prisma.tacitRoomMember.findFirst({
    where: {
      userId,
      room: {
        type: "MATCH",
        status: { in: ["WAITING", "IN_PROGRESS"] }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  if (matchRoomMember) {
    return getTacitRoomPayload(matchRoomMember.roomId);
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { gender: true }
  });
  const targetGender = currentUser?.gender === "MALE" ? "FEMALE" : "MALE";
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: userId },
      phone: { startsWith: "fake" },
      gender: targetGender
    },
    take: 200
  });
  const bot = candidates[Math.floor(Math.random() * candidates.length)] || null;
  if (!bot) return null;

  const topicCategory = normalizeTacitTopic(queueEntry.topicCategory);
  const room = await prisma.tacitRoom.create({
    data: {
      type: "MATCH",
      status: "IN_PROGRESS",
      ownerUserId: userId,
      topicCategory
    }
  });
  await prisma.tacitRoomMember.createMany({
    data: [
      { roomId: room.id, userId, status: "HOST", invitedByUserId: null },
      { roomId: room.id, userId: bot.id, status: "ACCEPTED", invitedByUserId: userId }
    ]
  });
  await seedTacitQuestionsIfMissing(room.id);
  await prisma.tacitMatchQueue.deleteMany({ where: { userId } });
  scheduleTacitBotAnswer(room.id).catch(() => {});
  return getTacitRoomPayload(room.id);
}

async function getTacitRoomPayload(roomId) {
  const room = await prisma.tacitRoom.findUnique({
    where: { id: roomId },
    include: {
      members: {
        include: { user: true },
        orderBy: { createdAt: "asc" }
      },
      questions: {
        include: { answers: true },
        orderBy: { sortOrder: "asc" }
      }
    }
  });
  if (!room) return null;
  const acceptedMembers = room.members.filter((m) => m.status === "HOST" || m.status === "ACCEPTED");
  let computedStatus = room.status;
  if (room.status !== "FINISHED" && room.status !== "CLOSED") {
    if (acceptedMembers.length >= 2 && room.questions.length > 0) computedStatus = "IN_PROGRESS";
    else computedStatus = "WAITING";
  }
  let score = 0;
  let finishedCount = 0;
  const questions = room.questions.map((q) => {
    const choices = {};
    q.answers.forEach((a) => {
      choices[a.userId] = a.choice;
    });
    const memberChoices = acceptedMembers.map((m) => choices[m.userId]).filter(Boolean);
    const isMatched = memberChoices.length >= 2 && memberChoices[0] === memberChoices[1];
    const isDone = memberChoices.length >= 2;
    if (isMatched) score += 10;
    if (isDone) finishedCount += 1;
    return {
      id: q.id,
      sortOrder: q.sortOrder,
      prompt: q.prompt,
      optionA: q.optionA,
      optionB: q.optionB,
      choices,
      matched: isMatched,
      done: isDone
    };
  });
  if (computedStatus !== "FINISHED" && room.questions.length > 0 && finishedCount >= room.questions.length) {
    computedStatus = "FINISHED";
  }
  if (computedStatus !== room.status) {
    await prisma.tacitRoom.update({ where: { id: room.id }, data: { status: computedStatus } });
    room.status = computedStatus;
  }
  return {
    id: room.id,
    type: room.type,
    status: room.status,
    ownerUserId: room.ownerUserId,
    topicCategory: room.topicCategory || "social",
    topicLabel: getTacitTopicLabel(room.topicCategory),
    acceptedCount: acceptedMembers.length,
    questionCount: room.questions.length,
    finishedCount,
    score,
    members: room.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.nickname,
      avatar: normalizeAvatarUrl(m.user.avatarUrl),
      status: m.status,
      invitedByUserId: m.invitedByUserId
    })),
    questions
  };
}

function emitTacitRoomUpdateToUsers(userIds, payload) {
  userIds.forEach((uid) => {
    const sockets = userSockets.get(String(uid));
    if (!sockets?.size) return;
    sockets.forEach((socketId) => io.to(socketId).emit("tacit:room:update", payload));
  });
}

function randomBotAnswerDelayMs() {
  return 2000 + Math.floor(Math.random() * 5000);
}

function randomTacitChoice() {
  return Math.random() > 0.5 ? "A" : "B";
}

async function scheduleTacitBotAnswer(roomId) {
  const room = await prisma.tacitRoom.findUnique({
    where: { id: roomId },
    include: {
      members: {
        include: { user: true }
      },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { answers: true }
      }
    }
  });
  if (!room || room.type !== "MATCH" || room.status !== "IN_PROGRESS") return;
  const activeMembers = room.members.filter((m) => m.status === "HOST" || m.status === "ACCEPTED");
  if (activeMembers.length < 2) return;
  const currentQuestion = room.questions.find((q) => {
    const answeredCount = activeMembers.filter((m) => q.answers.some((a) => a.userId === m.userId)).length;
    return answeredCount < 2;
  });
  if (!currentQuestion) return;
  const botMember = activeMembers.find(
    (m) => isFakeBotPhone(m.user?.phone) && !currentQuestion.answers.some((a) => a.userId === m.userId)
  );
  if (!botMember) return;

  const botUserId = String(botMember.userId);

  const timerKey = `${roomId}:${currentQuestion.id}:${botUserId}`;
  if (tacitBotAnswerTimers.has(timerKey)) return;

  const timer = setTimeout(async () => {
    tacitBotAnswerTimers.delete(timerKey);
    try {
      const choice = randomTacitChoice();
      await prisma.tacitAnswer.upsert({
        where: { questionId_userId: { questionId: currentQuestion.id, userId: botUserId } },
        update: { choice, answeredAt: new Date() },
        create: {
          roomId,
          questionId: currentQuestion.id,
          memberId: botMember.id,
          userId: botUserId,
          choice
        }
      });
      const payload = await getTacitRoomPayload(roomId);
      if (payload) emitTacitRoomUpdateToUsers(payload.members.map((m) => m.userId), payload);
      await scheduleTacitBotAnswer(roomId);
    } catch (_error) {}
  }, randomBotAnswerDelayMs());

  tacitBotAnswerTimers.set(timerKey, timer);
}

const DEFAULT_PASSWORD = "123456";
const VIRTUAL_USER_COUNT = 12;
const FAKE_BOT_COUNT_PER_GENDER = 100;

function randomPhone(existingPhones, prefix = "19") {
  let phone = "";
  do {
    if (prefix.startsWith("fake")) {
      phone = randomFakeBotPhoneDigits(prefix);
    } else {
      const suffix = String(randomInt(0, 999999999)).padStart(9, "0");
      phone = `${prefix}${suffix}`;
    }
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
    income: "1万-2万",
    industry: "互联网",
    hobbies: hobbiesPool[index % hobbiesPool.length],
    partnerExpectation: "真诚沟通，三观契合",
    profileCompleted: true,
    photoUrls: JSON.stringify([`https://picsum.photos/300/300?${photoSeed}`])
  };
}

async function loadAvatarUrlsByFolder(folder) {
  try {
    const dir = path.join(__dirname, `../../frontend/public/avatars/${folder}`);
    const files = await fs.readdir(dir);
    return files
      .filter((name) => /\.(jpg|jpeg|png|webp|gif)$/i.test(name))
      .sort()
      .map((name) => `/oss-media/fake-pictures/seed-avatars/${folder}/${name}`);
  } catch (_error) {
    return [];
  }
}

function buildFakeBotUser({ index, gender, avatarUrls, existingPhones }) {
  const male = gender === "MALE";
  const cityPool = ["上海", "深圳", "广州", "杭州", "成都", "北京", "重庆", "南京"];
  const hometownPool = ["苏州", "武汉", "西安", "长沙", "青岛", "郑州", "厦门", "天津"];
  const incomes = ["3000-5000", "5000-1万", "1万-2万", "2万以上"];
  const industries = ["互联网", "设计", "运营", "教育", "金融", "医疗", "传媒", "制造业"];
  const hobbiesPool = male
    ? ["篮球,健身,电影", "跑步,摄影,咖啡", "露营,自驾,音乐", "羽毛球,桌游,旅行"]
    : ["旅行,探店,摄影", "阅读,瑜伽,电影", "烘焙,插花,音乐", "羽毛球,徒步,美食"];
  const avatar = avatarUrls.length ? avatarUrls[index % avatarUrls.length] : `https://picsum.photos/300/300?fake-${gender}-${index}`;
  return {
    phone: randomPhone(existingPhones, `fake${male ? "m" : "f"}`),
    password: DEFAULT_PASSWORD,
    nickname: `隐藏款${male ? "男" : "女"}${String(index + 1).padStart(3, "0")}`,
    gender,
    age: randomInt(18, 28),
    height: male ? randomInt(168, 186) : randomInt(155, 172),
    weight: male ? randomInt(58, 82) : randomInt(43, 62),
    hometown: hometownPool[index % hometownPool.length],
    currentCity: cityPool[index % cityPool.length],
    income: incomes[index % incomes.length],
    industry: industries[index % industries.length],
    hobbies: hobbiesPool[index % hobbiesPool.length],
    partnerExpectation: "真诚沟通，彼此尊重，共同成长",
    profileCompleted: true,
    avatarUrl: avatar,
    photoUrls: JSON.stringify([avatar]),
    fakeRobotLibrary: "SYSTEM"
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

/** 保证所有假机器人可用「手机号 + 123456」登录 App（与种子/后台创建约定一致） */
async function syncFakeBotLoginPasswords() {
  try {
    await prisma.user.updateMany({
      where: {
        OR: [{ phone: { startsWith: "fakem" } }, { phone: { startsWith: "fakef" } }]
      },
      data: { password: DEFAULT_PASSWORD }
    });
  } catch (_e) {
    /* 避免阻塞启动 */
  }
}

/** 迁移旧库：凡 fakem/fakef 默认系统库；历史后台 adm 前缀录入的归用户机器人库 */
async function backfillFakeRobotLibraryFlags() {
  try {
    await prisma.user.updateMany({
      where: {
        fakeRobotLibrary: "NONE",
        OR: [{ phone: { startsWith: "fakem" } }, { phone: { startsWith: "fakef" } }]
      },
      data: { fakeRobotLibrary: "SYSTEM" }
    });
    await prisma.user.updateMany({
      where: {
        fakeRobotLibrary: "SYSTEM",
        OR: [{ phone: { startsWith: "fakefadm" } }, { phone: { startsWith: "fakemadm" } }]
      },
      data: { fakeRobotLibrary: "USER" }
    });
  } catch (_e) {
    /* 列尚未迁移等场景：避免阻塞进程启动 */
  }
}

async function ensureGiftCatalog() {
  const count = await prisma.giftCatalog.count();
  if (count === 0) {
    await prisma.giftCatalog.createMany({
      data: DEFAULT_GIFTS.map((g) => ({
        name: g.name,
        icon: g.icon,
        coinPrice: g.coinPrice,
        sortOrder: g.sortOrder,
        badge: g.badge || null,
        enabled: true
      }))
    });
    return;
  }
  await syncGiftCatalogFromDefaults();
}

async function syncGiftCatalogFromDefaults() {
  const rows = await prisma.giftCatalog.findMany({ orderBy: { sortOrder: "asc" } });
  for (let i = 0; i < DEFAULT_GIFTS.length; i++) {
    const g = DEFAULT_GIFTS[i];
    const data = {
      name: g.name,
      icon: g.icon,
      coinPrice: g.coinPrice,
      sortOrder: g.sortOrder,
      badge: g.badge || null,
      enabled: true
    };
    if (rows[i]) {
      await prisma.giftCatalog.update({ where: { id: rows[i].id }, data });
    } else {
      await prisma.giftCatalog.create({ data });
    }
  }
  if (rows.length > DEFAULT_GIFTS.length) {
    await prisma.giftCatalog.updateMany({
      where: { id: { in: rows.slice(DEFAULT_GIFTS.length).map((r) => r.id) } },
      data: { enabled: false }
    });
  }
}

async function normalizeFakeBotIncomes() {
  try {
    const robots = await prisma.user.findMany({
      where: {
        OR: [
          { fakeRobotLibrary: { in: ["SYSTEM", "USER"] } },
          { phone: { startsWith: "fakem" } },
          { phone: { startsWith: "fakef" } }
        ]
      },
      select: { id: true, income: true }
    });
    await Promise.all(
      robots.map(async (user) => {
        const next = normalizeIncomeRange(user.income);
        if (next !== user.income) {
          await prisma.user.update({ where: { id: user.id }, data: { income: next } });
        }
      })
    );
  } catch (_e) {
    /* 列尚未迁移等场景：避免阻塞进程启动 */
  }
}

async function ensureDefaultUsers() {
  await backfillFakeRobotLibraryFlags();
  await syncFakeBotLoginPasswords();
  await ensureGiftCatalog();
  await normalizeFakeBotIncomes();

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

  const [maleAvatarUrls, femaleAvatarUrls] = await Promise.all([
    loadAvatarUrlsByFolder("male"),
    loadAvatarUrlsByFolder("female")
  ]);
  const existingFakeBots = await prisma.user.findMany({
    where: { fakeRobotLibrary: "SYSTEM" },
    select: { phone: true, gender: true }
  });
  const fakePhoneSeed = new Set([
    ...allPhones,
    ...existingFakeBots.map((u) => u.phone)
  ]);
  const maleExisting = existingFakeBots.filter((u) => u.gender === "MALE").length;
  const femaleExisting = existingFakeBots.filter((u) => u.gender === "FEMALE").length;
  const maleMissing = Math.max(0, FAKE_BOT_COUNT_PER_GENDER - maleExisting);
  const femaleMissing = Math.max(0, FAKE_BOT_COUNT_PER_GENDER - femaleExisting);

  if (maleMissing > 0) {
    await prisma.user.createMany({
      data: Array.from({ length: maleMissing }, (_, idx) =>
        buildFakeBotUser({
          index: maleExisting + idx,
          gender: "MALE",
          avatarUrls: maleAvatarUrls,
          existingPhones: fakePhoneSeed
        })
      ),
      skipDuplicates: true
    });
  }

  if (femaleMissing > 0) {
    await prisma.user.createMany({
      data: Array.from({ length: femaleMissing }, (_, idx) =>
        buildFakeBotUser({
          index: femaleExisting + idx,
          gender: "FEMALE",
          avatarUrls: femaleAvatarUrls,
          existingPhones: fakePhoneSeed
        })
      ),
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

function stableUserHash(input) {
  let h = 2166136261;
  const s = String(input || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pseudoLatLngForUser(userId, centerLat, centerLng) {
  const hash = stableUserHash(userId);
  const angle = ((hash % 360000) / 1000) * (Math.PI / 180);
  const radiusKm = 2 + (hash % 11800) / 100;
  const latRad = (centerLat * Math.PI) / 180;
  const dLat = (radiusKm / 111.32) * Math.cos(angle);
  const dLng = (radiusKm / (111.32 * Math.cos(latRad || 0.01))) * Math.sin(angle);
  return { lat: centerLat + dLat, lng: centerLng + dLng };
}

function squareDistanceKmForUser(userId, viewerLat, viewerLng, cache) {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  if (cache && cache.has(uid)) return cache.get(uid);
  let km;
  if (Number.isFinite(viewerLat) && Number.isFinite(viewerLng)) {
    const pt = pseudoLatLngForUser(uid, viewerLat, viewerLng);
    km = Number(haversineKm(viewerLat, viewerLng, pt.lat, pt.lng).toFixed(1));
  } else {
    km = Number((2 + (stableUserHash(uid) % 11800) / 100).toFixed(1));
  }
  if (cache) cache.set(uid, km);
  return km;
}

function parseViewerCoords(req) {
  const lat = Number(req.query.viewerLat);
  const lng = Number(req.query.viewerLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { lat: null, lng: null };
  return { lat, lng };
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
      createdAt: formatAgo(minutesAgo)
    });
  }
  return posts;
}

let squarePostPool = createSquarePostPool(5000).sort((a, b) => a.minutesAgo - b.minutesAgo);

function safeParseMomentImageUrls(raw) {
  try {
    const j = JSON.parse(raw || "[]");
    return Array.isArray(j) ? j.map(String) : [];
  } catch {
    return [];
  }
}

function formatSquareMomentTime(d) {
  const t = new Date(d).getTime();
  const diff = Math.max(0, Date.now() - t);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(d).toLocaleDateString("zh-CN");
}

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

/** 私有 OSS 同源代理：浏览器请求 API /oss-media/{key}，服务端用 AK 读对象 */
app.use(async (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (!req.path.startsWith("/oss-media/")) return next();
  if (!oss.ossConfigured()) {
    return res.status(503).json({ message: "OSS 未配置，无法代理读取" });
  }
  let objectKey;
  try {
    objectKey = decodeURIComponent(req.path.slice("/oss-media/".length));
  } catch (_e) {
    return res.status(400).end();
  }
  if (!objectKey || !oss.isAllowedOssProxyKey(objectKey)) {
    return res.status(404).end();
  }
  try {
    if (req.method === "HEAD") {
      const h = await oss.headOssObject(objectKey);
      const headers = h.res?.headers || {};
      const ct = headers["content-type"] || "application/octet-stream";
      const cl = headers["content-length"];
      res.setHeader("Content-Type", ct);
      if (cl != null) res.setHeader("Content-Length", String(cl));
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).end();
    }
    const result = await oss.getOssObjectBuffer(objectKey);
    const headers = result.res?.headers || {};
    const ct = headers["content-type"] || "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.status(200).send(result.content);
  } catch (e) {
    const status = e.status || e.statusCode;
    if (status === 404 || String(e?.code || "").includes("NoSuch")) {
      return res.status(404).end();
    }
    console.error("[oss-media]", e);
    return res.status(502).json({ message: "读取 OSS 失败" });
  }
});

app.use(
  "/admin/api",
  createAdminRouter({
    prisma,
    uploadRoot,
    getOnlineUserIds: () => Array.from(userSockets.keys()),
    createImpersonationCode,
    getPublicSiteUrl,
    emitChatMessage: (toUserId, payload) => {
      const targetSockets = userSockets.get(String(toUserId));
      if (targetSockets?.size) {
        targetSockets.forEach((socketId) => {
          io.to(socketId).emit("chat:message", payload);
        });
      }
    }
  })
);
app.use("/uploads", express.static(uploadRoot));

app.post("/chat/upload", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const { fileName, dataUrl, kind } = req.body;
    const uploadCategory = String(req.body?.uploadCategory || "chat")
      .trim()
      .toLowerCase();
    const mediaKind = kind === "AUDIO" ? "AUDIO" : "IMAGE";
    if (!fileName || !dataUrl || !String(dataUrl).startsWith("data:")) {
      return res.status(400).json({ message: "上传参数不完整" });
    }
    const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ message: "文件格式不正确" });
    const mimeType = match[1];
    const base64 = match[2];
    const allowedImage = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const allowedAudio = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3"];
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

    if (oss.ossConfigured()) {
      try {
        if (mediaKind === "IMAGE") {
          const prefix = uploadCategory === "profile" ? "zhenren-pictures" : "chat-history-pictures";
          const { url, thumbUrl } = await oss.uploadProfileOrChatImage(buffer, ext, mimeType, prefix);
          return res.json({ url, thumbUrl });
        }
        const { url, thumbUrl } = await oss.uploadChatAudioBuffer(buffer, ext, mimeType);
        return res.json({ url, thumbUrl });
      } catch (e) {
        console.error("[chat/upload OSS]", e);
        return res.status(500).json({ message: oss.humanizeOssError(e) });
      }
    }

    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        message: "生产环境须配置 OSS（图片 CDN），本地上传已禁用，请联系管理员检查 ALIYUN_OSS_*"
      });
    }

    const folder = mediaKind === "AUDIO" ? "audio" : "image";
    const dir = path.join(uploadRoot, folder);
    await fs.mkdir(dir, { recursive: true });
    const safeName = `${Date.now()}-${randomUUID()}.${ext}`;
    if (mediaKind === "IMAGE") {
      const { url, thumbUrl } = await saveChatImageWithThumb(buffer, folder, safeName);
      return res.json({ url, thumbUrl });
    }
    const fullPath = path.join(dir, safeName);
    await fs.writeFile(fullPath, buffer);
    return res.json({ url: `/uploads/${folder}/${safeName}`, thumbUrl: null });
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
    const token = await issueAuthTokenPersisted(user.id);
    return res.json({ user: sanitizeUserMediaFields(user), token, needsProfile: true });
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
    return res.json({ user: sanitizeUserMediaFields(user) });
  } catch (error) {
    if (error?.name?.includes("PrismaClient")) {
      return res.status(503).json({ message: "数据库暂时不可用，请稍后重试" });
    }
    return res.status(400).json({ message: error.message });
  }
});

async function handleAuthProfileUpdate(req, res) {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const body = req.body || {};
    const data = {};
    if (typeof body.nickname === "string" && body.nickname.trim()) {
      data.nickname = body.nickname.trim();
    }
    if (body.avatarUrl !== undefined) {
      data.avatarUrl = body.avatarUrl ? String(body.avatarUrl) : null;
    }
    if (body.currentCity !== undefined) {
      data.currentCity = String(body.currentCity || "");
    }
    if (body.hometown !== undefined) {
      data.hometown = String(body.hometown || "");
    }
    if (body.hobbies !== undefined) {
      data.hobbies = String(body.hobbies || "");
    }
    if (body.partnerExpectation !== undefined) {
      data.partnerExpectation = String(body.partnerExpectation || "");
    }
    if (body.photoUrls !== undefined) {
      let urls = body.photoUrls;
      if (typeof urls === "string") {
        try {
          urls = JSON.parse(urls);
        } catch (_e) {
          return res.status(400).json({ message: "相册数据格式无效" });
        }
      }
      if (!Array.isArray(urls)) {
        return res.status(400).json({ message: "相册必须是数组" });
      }
      // 保留空字符串占位，便于前端 6 宫格与槽位对齐（最多 10 条）
      const cleaned = urls.map((u) => (typeof u === "string" ? u.trim() : "")).slice(0, 10);
      data.photoUrls = JSON.stringify(cleaned);
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "没有可更新的字段" });
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data
    });
    return res.json({ user: sanitizeUserMediaFields(user) });
  } catch (error) {
    if (error?.name?.includes("PrismaClient")) {
      return res.status(503).json({ message: "数据库暂时不可用，请稍后重试" });
    }
    return res.status(500).json({ message: error.message || "更新资料失败" });
  }
}

app.patch("/auth/profile", handleAuthProfileUpdate);
app.post("/auth/profile", handleAuthProfileUpdate);

app.post("/auth/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await prisma.user.findFirst({ where: { phone, password } });
    if (!user) return res.status(401).json({ message: "手机号或密码错误" });
    const token = await issueAuthTokenPersisted(user.id);
    return res.json({ user: sanitizeUserMediaFields(user), token, needsProfile: !user.profileCompleted });
  } catch (error) {
    if (error?.name?.includes("PrismaClient")) {
      return res.status(503).json({ message: "数据库暂时不可用，请稍后重试" });
    }
    return res.status(500).json({ message: "登录失败，请稍后重试" });
  }
});

app.get("/auth/impersonate", async (req, res) => {
  try {
    const code = String(req.query.code || req.query.asUser || "").trim();
    if (!code) return res.status(400).json({ message: "登录凭证无效" });
    const userId = consumeImpersonationCode(code);
    if (!userId) return res.status(401).json({ message: "登录链接已失效，请从后台重新打开" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "用户不存在" });
    const token = await issueAuthTokenPersisted(user.id);
    return res.json({ user: sanitizeUserMediaFields(user), token, needsProfile: !user.profileCompleted });
  } catch (error) {
    return res.status(500).json({ message: "自动登录失败" });
  }
});

app.get("/square/posts", async (_req, res) => {
  const limit = Math.min(Number(_req.query.limit) || 60, 100);
  const offset = Math.max(Number(_req.query.offset) || 0, 0);
  const refresh = String(_req.query.refresh || "0") === "1";
  const { lat: viewerLat, lng: viewerLng } = parseViewerCoords(_req);
  const distanceCache = new Map();

  try {
    if (refresh) {
      squarePostPool = createSquarePostPool(5000).sort((a, b) => a.minutesAgo - b.minutesAgo);
    }

    const totalReal = await prisma.squareMoment.count();

    if (totalReal === 0) {
      const robotRows = await prisma.user.findMany({
        where: systemRobotLibraryWhereExtras(),
        select: { id: true, nickname: true, gender: true, avatarUrl: true },
        take: 240
      });
      const maleRobots = shuffleList(robotRows.filter((r) => r.gender === "MALE"));
      const femaleRobots = shuffleList(robotRows.filter((r) => r.gender === "FEMALE"));
      let maleIdx = 0;
      let femaleIdx = 0;
      const sliced = squarePostPool.slice(offset, offset + limit);
      const posts = sliced.map(({ minutesAgo, ...rest }) => {
        const pool = rest.gender === "MALE" ? maleRobots : femaleRobots;
        const idx = rest.gender === "MALE" ? maleIdx++ : femaleIdx++;
        const robot = pool.length ? pool[idx % pool.length] : robotRows[idx % Math.max(robotRows.length, 1)];
        return {
          ...rest,
          userId: robot?.id || "",
          nickname: robot?.nickname || rest.nickname,
          avatarUrl: robot?.avatarUrl || "",
          imageUrls: [],
          distanceKm: squareDistanceKmForUser(robot?.id || rest.nickname, viewerLat, viewerLng, distanceCache)
        };
      });
      const nextOffset = offset + posts.length;
      return res.json({
        posts,
        total: squarePostPool.length,
        offset,
        nextOffset,
        hasMore: nextOffset < squarePostPool.length,
        feedSource: "demo"
      });
    }

    const rows = await prisma.squareMoment.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        user: { select: { nickname: true, gender: true, avatarUrl: true } }
      }
    });

    const posts = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      nickname: row.user.nickname,
      gender: row.user.gender,
      avatarUrl: normalizeAvatarUrl(row.user.avatarUrl),
      text: row.text,
      likes: row.likes,
      imageUrls: normalizeMediaUrlList(safeParseMomentImageUrls(row.imageUrls)),
      createdAt: formatSquareMomentTime(row.createdAt),
      distanceKm: squareDistanceKmForUser(row.userId, viewerLat, viewerLng, distanceCache),
      feedSource: "user"
    }));

    const nextOffset = offset + posts.length;
    res.json({
      posts,
      total: totalReal,
      offset,
      nextOffset,
      hasMore: nextOffset < totalReal,
      feedSource: "user"
    });
  } catch (e) {
    console.error("[square/posts]", e);
    res.status(500).json({ message: "加载动态失败" });
  }
});

app.post("/square/posts/author-ids", async (req, res) => {
  try {
    const momentIds = Array.isArray(req.body?.momentIds)
      ? req.body.momentIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 80)
      : [];
    const nicknames = Array.isArray(req.body?.nicknames)
      ? [...new Set(req.body.nicknames.map((n) => String(n || "").trim()).filter(Boolean))].slice(0, 40)
      : [];
    const authors = {};
    const nickAuthors = {};

    if (momentIds.length) {
      const rows = await prisma.squareMoment.findMany({
        where: { id: { in: momentIds } },
        select: { id: true, userId: true }
      });
      for (const row of rows) authors[row.id] = row.userId;
    }

    for (const nickname of nicknames) {
      const row = await prisma.user.findFirst({
        where: { nickname },
        select: { id: true },
        orderBy: { createdAt: "desc" }
      });
      if (row) nickAuthors[nickname] = row.id;
    }

    res.json({ authors, nickAuthors });
  } catch (e) {
    console.error("[square/posts/author-ids]", e);
    res.status(500).json({ message: "解析作者失败" });
  }
});

app.get("/square/posts/resolve-author", async (req, res) => {
  try {
    const momentId = String(req.query.momentId || "").trim();
    const nickname = String(req.query.nickname || "").trim();

    if (momentId) {
      const moment = await prisma.squareMoment.findUnique({
        where: { id: momentId },
        select: { userId: true }
      });
      if (moment?.userId) return res.json({ userId: moment.userId });
    }

    if (nickname) {
      const userRow = await prisma.user.findFirst({
        where: { nickname },
        select: { id: true },
        orderBy: { createdAt: "desc" }
      });
      if (userRow?.id) return res.json({ userId: userRow.id });
    }

    return res.status(404).json({ message: "未找到该用户" });
  } catch (e) {
    console.error("[square/posts/resolve-author]", e);
    res.status(500).json({ message: "解析作者失败" });
  }
});

app.get("/square/posts/mine", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
  try {
    const rows = await prisma.squareMoment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json({
      posts: rows.map((row) => ({
        id: row.id,
        text: row.text,
        likes: row.likes,
        imageUrls: normalizeMediaUrlList(safeParseMomentImageUrls(row.imageUrls)),
        createdAt: formatSquareMomentTime(row.createdAt)
      }))
    });
  } catch (e) {
    console.error("[square/posts/mine]", e);
    res.status(500).json({ message: "加载失败" });
  }
});

const squareMomentPostSchema = z
  .object({
    text: z.string().max(2000).optional().default(""),
    imageUrls: z.array(z.string().max(2048)).max(9).optional().default([])
  })
  .refine((d) => String(d.text || "").trim().length > 0 || (d.imageUrls && d.imageUrls.length > 0), {
    message: "至少填写文字或上传一张图片"
  });

app.post("/square/posts", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
  try {
    const parsed = squareMomentPostSchema.parse(req.body);
    const text = String(parsed.text || "").trim();
    const urls = (parsed.imageUrls || []).map((u) => String(u).trim()).filter(Boolean);
    for (const u of urls) {
      if (!isAllowedSquareMediaUrl(u)) {
        return res.status(400).json({ message: "包含不允许的图片地址" });
      }
    }

    const row = await prisma.squareMoment.create({
      data: {
        userId,
        text,
        imageUrls: JSON.stringify(urls)
      },
      include: {
        user: { select: { nickname: true, gender: true, avatarUrl: true } }
      }
    });

    res.json({
      post: {
        id: row.id,
        userId: row.userId,
        nickname: row.user.nickname,
        gender: row.user.gender,
        avatarUrl: normalizeAvatarUrl(row.user.avatarUrl),
        text: row.text,
        likes: row.likes,
        imageUrls: normalizeMediaUrlList(safeParseMomentImageUrls(row.imageUrls)),
        createdAt: formatSquareMomentTime(row.createdAt),
        distanceKm: 0,
        feedSource: "user"
      }
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: e.issues[0]?.message || "参数错误" });
    }
    console.error("[square/posts POST]", e);
    res.status(500).json({ message: e.message || "发布失败" });
  }
});

app.get("/match/online-count", (_req, res) => {
  const base = Math.floor(Math.random() * (300000 - 180000 + 1)) + 180000;
  const swing = Math.floor(Math.random() * 5001);
  const direction = Math.random() > 0.5 ? 1 : -1;
  const count = Math.max(180000, Math.min(300000, base + direction * swing));
  res.json({ count });
});

/** 未执行 migrate / 回填失败时，NONE + fakem/fakef 仍视为系统展示机器人 */
function systemRobotLibraryWhereExtras() {
  return {
    OR: [
      { fakeRobotLibrary: "SYSTEM" },
      {
        AND: [
          { fakeRobotLibrary: "NONE" },
          { OR: [{ phone: { startsWith: "fakem" } }, { phone: { startsWith: "fakef" } }] }
        ]
      }
    ]
  };
}

/** 登录页头像：按性别各抽一批再混洗，避免 findMany 默认顺序先返回整批男号 */
async function pickBalancedSystemRobotAvatars(total = 10) {
  const baseWhere = systemRobotLibraryWhereExtras();
  const select = { avatarUrl: true, nickname: true, gender: true };
  const poolSize = Math.max(total * 4, 24);
  const perGender = Math.ceil(total / 2);
  const [males, females] = await Promise.all([
    prisma.user.findMany({
      where: { AND: [baseWhere, { gender: "MALE" }] },
      select,
      take: poolSize
    }),
    prisma.user.findMany({
      where: { AND: [baseWhere, { gender: "FEMALE" }] },
      select,
      take: poolSize
    })
  ]);
  const picked = [
    ...shuffleList(males).slice(0, perGender),
    ...shuffleList(females).slice(0, perGender)
  ];
  return shuffleList(picked).slice(0, total);
}

/** 登录 / 落地页：系统机器人头像展示（无需登录） */
app.get("/public/robot-library/system", async (_req, res) => {
  try {
    const shuffled = await pickBalancedSystemRobotAvatars(10);
    return res.json({
      items: shuffled.map((u) => ({
        avatar: normalizeSeedAvatarUrl(u.avatarUrl || ""),
        nickname: u.nickname,
        gender: u.gender
      }))
    });
  } catch (_error) {
    return res.json({ items: [] });
  }
});

/** 将 localhost /avatars 或 OSS 路径转为 img CDN 直链（加速加载） */
function getImageCdnBase() {
  return String(process.env.ALIYUN_OSS_PUBLIC_BASE_URL || process.env.IMAGE_CDN_BASE || "https://img.manghe.me")
    .trim()
    .replace(/\/$/, "");
}

function normalizeSeedAvatarUrl(url) {
  const s = String(url ?? "").trim();
  if (!s) return "";
  const base = getImageCdnBase();
  let path = s;
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      if (/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
        path = u.pathname;
      } else {
        const markers = ["/fake-pictures/", "/chat-history-pictures/", "/zhenren-pictures/"];
        for (const m of markers) {
          const i = u.pathname.indexOf(m);
          if (i !== -1) {
            return `${base}${u.pathname.slice(i)}${u.search || ""}`;
          }
        }
        return s;
      }
    }
  } catch (_e) {
    /* ignore */
  }
  const avatarMatch = path.match(/\/avatars\/(male|female)\/([^/?#]+)$/i);
  if (avatarMatch) {
    return `${base}/fake-pictures/seed-avatars/${avatarMatch[1]}/${avatarMatch[2]}`;
  }
  if (path.startsWith("/oss-media/")) {
    const key = path.slice("/oss-media/".length);
    if (oss.isAllowedOssProxyKey(key)) {
      return `${base}/${key}`;
    }
  }
  if (path.startsWith("/fake-pictures/") || path.startsWith("/chat-history-pictures/") || path.startsWith("/zhenren-pictures/")) {
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return s;
}

function buildRobotGalleryUrls(avatarUrl, photoUrlsJson) {
  const primary = String(avatarUrl ?? "").trim();
  let slots = [];
  try {
    const parsed = typeof photoUrlsJson === "string" ? JSON.parse(photoUrlsJson || "[]") : photoUrlsJson;
    if (Array.isArray(parsed)) slots = parsed;
  } catch (_e) {
    slots = [];
  }
  const seen = new Set();
  const out = [];
  const push = (u) => {
    const s = String(u ?? "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  push(primary);
  for (const u of slots) push(u);
  return out.length > 0 ? out : primary ? [primary] : [];
}

function mapPlanetRobotProfile(item) {
  return {
    id: item.id,
    nickname: item.nickname,
    age: item.age,
    city: item.currentCity || "",
    hometown: item.hometown || "",
    height: typeof item.height === "number" ? item.height : item.height != null ? Number(item.height) : null,
    weight: typeof item.weight === "number" ? item.weight : item.weight != null ? Number(item.weight) : null,
    income: item.income != null ? String(item.income) : "",
    industry: item.industry || "",
    hobbies: item.hobbies || "",
    avatar: normalizeSeedAvatarUrl(item.avatarUrl || ""),
    gender: item.gender,
    partnerExpectation: String(item.partnerExpectation ?? "").trim(),
    galleryUrls: buildRobotGalleryUrls(item.avatarUrl, item.photoUrls).map((u) => normalizeSeedAvatarUrl(u))
  };
}

const matchBotProfileSelect = {
  id: true,
  nickname: true,
  age: true,
  currentCity: true,
  hometown: true,
  height: true,
  weight: true,
  income: true,
  industry: true,
  hobbies: true,
  avatarUrl: true,
  gender: true,
  partnerExpectation: true,
  photoUrls: true,
  _count: { select: { squareMoments: true } }
};

/** 动态越多权重越高，仍保留无动态机器人的被匹配机会 */
function pickWeightedBotByMomentCount(candidates) {
  if (!candidates.length) return null;
  const weights = candidates.map((bot) => 1 + (bot._count?.squareMoments || 0));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

async function planetRobotLibrary(req, res, library) {
  try {
    const viewerId = getAuthUserId(req);
    if (!viewerId) return res.status(401).json({ message: "未登录或登录态失效" });
    const viewer = await prisma.user.findUnique({
      where: { id: viewerId },
      select: { gender: true }
    });
    if (!viewer) return res.status(401).json({ message: "未登录或登录态失效" });
    const preferredGender = viewer.gender === "MALE" ? "FEMALE" : "MALE";
    const where =
      library === "SYSTEM"
        ? {
            gender: preferredGender,
            ...systemRobotLibraryWhereExtras()
          }
        : {
            gender: preferredGender,
            OR: [
              { fakeRobotLibrary: "USER" },
              {
                AND: [
                  { fakeRobotLibrary: "NONE" },
                  {
                    OR: [{ phone: { startsWith: "fakefadm" } }, { phone: { startsWith: "fakemadm" } }]
                  }
                ]
              }
            ]
          };
    const list = await prisma.user.findMany({
      where,
      select: {
        id: true,
        nickname: true,
        age: true,
        currentCity: true,
        hometown: true,
        height: true,
        weight: true,
        income: true,
        industry: true,
        hobbies: true,
        partnerExpectation: true,
        photoUrls: true,
        avatarUrl: true,
        gender: true
      },
      take: 80
    });
    const shuffled = shuffleList(list).slice(0, 36);
    return res.json({
      profiles: shuffled.map(mapPlanetRobotProfile)
    });
  } catch (_error) {
    return res.status(500).json({ message: "加载机器人资料失败" });
  }
}

/** 系统机器人库：盲盒星球卡片轮播等展示（仅 SYSTEM） */
app.get("/planet/robot-library/system", (req, res) => planetRobotLibrary(req, res, "SYSTEM"));

/** 用户机器人库：匹配 / 小游戏对手池（仅 USER） */
app.get("/planet/robot-library/user", (req, res) => planetRobotLibrary(req, res, "USER"));

/** 兼容旧前端路径：等同于系统库展示 */
app.get("/planet/hidden-profiles", (req, res) => planetRobotLibrary(req, res, "SYSTEM"));

app.post("/match/start", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "").trim();
    if (!userId) return res.status(400).json({ message: "请先登录后再匹配" });

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) return res.status(404).json({ message: "用户不存在" });

    const oppGender = currentUser.gender === "MALE" ? "FEMALE" : "MALE";
    const baseUserBotWhere = {
      id: { not: currentUser.id },
      gender: oppGender,
      OR: [
        { fakeRobotLibrary: "USER" },
        {
          AND: [
            { fakeRobotLibrary: "NONE" },
            {
              OR: [{ phone: { startsWith: "fakefadm" } }, { phone: { startsWith: "fakemadm" } }]
            }
          ]
        }
      ]
    };

    const pastSessions = await prisma.matchSession.findMany({
      where: {
        OR: [{ maleUserId: currentUser.id }, { femaleUserId: currentUser.id }]
      },
      select: { maleUserId: true, femaleUserId: true },
      orderBy: { startedAt: "desc" },
      take: 400
    });
    const pastOpponentIds = new Set();
    for (const s of pastSessions) {
      const opp = s.maleUserId === currentUser.id ? s.femaleUserId : s.maleUserId;
      if (opp && opp !== currentUser.id) pastOpponentIds.add(opp);
    }
    const excludeIds = Array.from(new Set([currentUser.id, ...pastOpponentIds]));
    let userBotWhere =
      excludeIds.length > 1 ? { ...baseUserBotWhere, id: { notIn: excludeIds } } : baseUserBotWhere;

    let candidates = await prisma.user.findMany({
      where: userBotWhere,
      select: matchBotProfileSelect
    });
    if (!candidates.length) {
      candidates = await prisma.user.findMany({
        where: baseUserBotWhere,
        select: matchBotProfileSelect
      });
    }
    if (!candidates.length) {
      return res.status(404).json({
        message: "暂时没有可用的用户机器人，请在后台「用户机器人库」中添加后再匹配"
      });
    }

    const target = pickWeightedBotByMomentCount(candidates);
    if (!target) {
      return res.status(404).json({
        message: "暂时没有可用的用户机器人，请在后台「用户机器人库」中添加后再匹配"
      });
    }

    const [maleUserId, femaleUserId] =
      currentUser.gender === "MALE" ? [currentUser.id, target.id] : [target.id, currentUser.id];

    const session = await prisma.matchSession.create({ data: { maleUserId, femaleUserId } });
    return res.json({
      session,
      targetBlindBox: { id: target.id, nickname: target.nickname || "盲盒用户" },
      targetPlanetProfile: mapPlanetRobotProfile(target)
    });
  } catch (_error) {
    return res.status(500).json({ message: "匹配失败，请稍后重试" });
  }
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

const membershipOrderCreateSchema = z.object({
  userId: z.string().min(1),
  plan: z.enum(["MONTH", "QUARTER", "HALF_YEAR", "YEAR"]),
  paymentChannel: z.enum(["WECHAT", "ALIPAY"])
});

const membershipOrderPaySchema = z.object({
  userId: z.string().min(1),
  paymentMode: z.enum(["mock", "wechat_jsapi"]).optional()
});

async function fulfillWechatPaidOrder(orderType, orderId, userId) {
  if (orderType === "membership") {
    return payMembershipOrder(orderId, userId);
  }
  return payCoinRechargeOrder(orderId, userId);
}

async function createWechatJsapiPayment(orderType, order, userId, description) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { wechatOpenId: true }
  });
  if (!user?.wechatOpenId) {
    throw new Error("请先完成微信授权后再支付");
  }
  const outTradeNo = buildOutTradeNo(orderType, order.id);
  const wechatPay = await createJsapiPrepay({
    description,
    outTradeNo,
    amountYuan: order.amount,
    openid: user.wechatOpenId
  });
  return { pending: true, outTradeNo, wechatPay, order };
}

const membershipMonthsMap = { MONTH: 1, QUARTER: 3, HALF_YEAR: 6, YEAR: 12 };

function buildMembershipExpire(plan, currentExpireAt = null) {
  const months = membershipMonthsMap[plan] || 0;
  const now = new Date();
  const base =
    currentExpireAt && new Date(currentExpireAt).getTime() > now.getTime()
      ? new Date(currentExpireAt)
      : now;
  base.setMonth(base.getMonth() + months);
  return base;
}

async function payMembershipOrder(orderId, userId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.membershipOrder.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new Error("订单不存在或无权限");
    }
    if (order.status === "PAID") {
      const paidUser = await tx.user.findUnique({ where: { id: userId } });
      return { order, user: paidUser, paid: order.amount, membershipExpireAt: paidUser?.membershipExpireAt || null };
    }
    if (order.status !== "PENDING") {
      throw new Error("订单状态不可支付");
    }
    const currentUser = await tx.user.findUnique({ where: { id: userId } });
    if (!currentUser) throw new Error("用户不存在");
    const expire = buildMembershipExpire(order.plan, currentUser.membershipExpireAt);
    const [paidOrder, updatedUser] = await Promise.all([
      tx.membershipOrder.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: new Date() }
      }),
      tx.user.update({
        where: { id: userId },
        data: { membershipType: order.plan, membershipExpireAt: expire }
      })
    ]);
    return { order: paidOrder, user: updatedUser, paid: order.amount, membershipExpireAt: expire };
  });
}

async function cancelMembershipOrder(orderId, userId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.membershipOrder.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new Error("订单不存在或无权限");
    }
    if (order.status === "PAID") {
      throw new Error("订单已支付，无法取消");
    }
    if (order.status === "FAILED") {
      return order;
    }
    return tx.membershipOrder.update({
      where: { id: order.id },
      data: { status: "FAILED" }
    });
  });
}

app.post("/membership/orders", async (req, res) => {
  try {
    const parsed = membershipOrderCreateSchema.parse(req.body || {});
    const user = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, membershipExpireAt: true, membershipType: true }
    });
    if (!user) return res.status(404).json({ message: "用户不存在" });
    const amount = MEMBERSHIP_PRICE[parsed.plan];
    const membershipExpireAt = buildMembershipExpire(parsed.plan, user.membershipExpireAt);
    const order = await prisma.membershipOrder.create({
      data: {
        userId: parsed.userId,
        plan: parsed.plan,
        paymentChannel: parsed.paymentChannel,
        amount
      }
    });
    return res.json({
      order,
      paid: amount,
      membershipExpireAt,
      renewStacked:
        Boolean(user.membershipExpireAt) && new Date(user.membershipExpireAt).getTime() > Date.now()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "参数错误" });
    }
    return res.status(400).json({ message: error.message || "创建订单失败" });
  }
});

app.post("/membership/orders/:orderId/pay", async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId) return res.status(400).json({ message: "订单号无效" });
    const parsed = membershipOrderPaySchema.parse(req.body || {});
    if (parsed.paymentMode === "wechat_jsapi") {
      if (!isWechatPayConfigured()) {
        return res.status(503).json({ message: "微信支付未配置，请联系管理员" });
      }
      const order = await prisma.membershipOrder.findUnique({ where: { id: orderId } });
      if (!order || order.userId !== parsed.userId) {
        return res.status(404).json({ message: "订单不存在或无权限" });
      }
      const payload = await createWechatJsapiPayment(
        "membership",
        order,
        parsed.userId,
        `盲盒星球 VIP ${order.plan}`
      );
      return res.json(payload);
    }
    const result = await payMembershipOrder(orderId, parsed.userId);
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "参数错误" });
    }
    return res.status(400).json({ message: error.message || "支付失败" });
  }
});

app.post("/membership/orders/:orderId/cancel", async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId) return res.status(400).json({ message: "订单号无效" });
    const parsed = membershipOrderPaySchema.parse(req.body || {});
    const order = await cancelMembershipOrder(orderId, parsed.userId);
    return res.json({ order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "参数错误" });
    }
    return res.status(400).json({ message: error.message || "取消订单失败" });
  }
});

// 兼容旧版前端：一键开通（内部仍按订单流转）
function findCoinPackage(packageId) {
  return COIN_PACKAGES.find((p) => p.id === String(packageId || "").trim()) || null;
}

async function payCoinRechargeOrder(orderId, userId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.coinRechargeOrder.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new Error("订单不存在或无权限");
    }
    if (order.status === "PAID") {
      const paidUser = await tx.user.findUnique({ where: { id: userId } });
      return { order, user: paidUser, wallet: walletSnapshot(paidUser) };
    }
    if (order.status !== "PENDING") {
      throw new Error("订单状态不可支付");
    }
    const [paidOrder, rechargeResult] = await Promise.all([
      tx.coinRechargeOrder.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: new Date() }
      }),
      applyCoinRecharge(tx, userId, order.coins, order.amount, order.id)
    ]);
    return { order: paidOrder, user: rechargeResult.user, wallet: rechargeResult.wallet };
  });
}

async function cancelCoinRechargeOrder(orderId, userId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.coinRechargeOrder.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new Error("订单不存在或无权限");
    }
    if (order.status === "PAID") throw new Error("订单已支付，无法取消");
    if (order.status === "FAILED") return order;
    return tx.coinRechargeOrder.update({
      where: { id: order.id },
      data: { status: "FAILED" }
    });
  });
}

app.get("/wallet", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      coinBalance: true,
      totalCoinRecharged: true,
      totalCoinSpent: true,
      contributionPoints: true,
      charmValue: true,
      wealthLevel: true,
      membershipType: true,
      membershipExpireAt: true
    }
  });
  if (!user) return res.status(404).json({ message: "用户不存在" });
  return res.json({ wallet: walletSnapshot(user) });
});

app.get("/points/ledger", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
  const pointType = String(req.query.pointType || "").trim();
  const take = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const where = { userId };
  if (pointType === "CONTRIBUTION" || pointType === "CHARM") {
    where.pointType = pointType;
  }
  const rows = await prisma.pointLedger.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take
  });
  return res.json({ ledger: rows });
});

app.get("/membership/points-redeem", (_req, res) => {
  return res.json({ options: POINT_MEMBERSHIP_REDEEM });
});

const membershipRedeemSchema = z.object({
  redeemId: z.string().min(1)
});

app.post("/membership/redeem", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const parsed = membershipRedeemSchema.parse(req.body || {});
    const result = await prisma.$transaction(async (tx) =>
      redeemPointsMembership(tx, userId, parsed.redeemId)
    );
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "参数错误" });
    }
    return res.status(400).json({ message: error.message || "兑换失败" });
  }
});

app.get("/gifts/catalog", async (_req, res) => {
  const gifts = await prisma.giftCatalog.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" }
  });
  return res.json({ gifts });
});

const giftSendSchema = z.object({
  toUserId: z.string().min(1),
  giftId: z.string().min(1)
});

app.post("/gifts/send", async (req, res) => {
  try {
    const fromUserId = getAuthUserId(req);
    if (!fromUserId) return res.status(401).json({ message: "未登录或登录态失效" });
    const parsed = giftSendSchema.parse(req.body || {});
    const gift = await prisma.giftCatalog.findFirst({
      where: { id: parsed.giftId, enabled: true }
    });
    if (!gift) return res.status(404).json({ message: "礼物不存在" });
    const toUser = await prisma.user.findUnique({ where: { id: parsed.toUserId } });
    if (!toUser) return res.status(404).json({ message: "对方用户不存在" });

    const result = await prisma.$transaction(async (tx) => {
      const spendResult = await applyCoinSpend(tx, fromUserId, gift.coinPrice, "GIFT_SEND", gift.id);
      const giftText = JSON.stringify({
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: gift.icon,
        coinPrice: gift.coinPrice
      });
      const message = await tx.chatMessage.create({
        data: {
          fromUserId,
          toUserId: parsed.toUserId,
          kind: "GIFT",
          text: giftText,
          mediaUrl: gift.icon
        }
      });
      const giftTx = await tx.giftTransaction.create({
        data: {
          giftId: gift.id,
          fromUserId,
          toUserId: parsed.toUserId,
          coinCost: gift.coinPrice,
          giftName: gift.name,
          giftIcon: gift.icon,
          messageId: message.id
        }
      });
      await applyCharmGain(tx, parsed.toUserId, gift.coinPrice, giftTx.id);
      return { message, wallet: spendResult.wallet, pointsEarned: spendResult.pointsEarned };
    });

    const payload = {
      id: result.message.id,
      fromUserId,
      toUserId: parsed.toUserId,
      kind: "GIFT",
      text: result.message.text,
      mediaUrl: result.message.mediaUrl,
      thumbMediaUrl: null,
      audioDurationSec: null,
      createdAt: result.message.createdAt.toISOString()
    };
    const targetSockets = userSockets.get(String(parsed.toUserId));
    if (targetSockets?.size) {
      targetSockets.forEach((socketId) => {
        io.to(socketId).emit("chat:message", payload);
      });
    }
    return res.json({ message: payload, wallet: result.wallet, pointsEarned: result.pointsEarned });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "参数错误" });
    }
    return res.status(400).json({ message: error.message || "送礼失败" });
  }
});

app.get("/coins/packages", (_req, res) => {
  return res.json({ packages: COIN_PACKAGES, yuanRate: COIN_YUAN_RATE });
});

app.get("/coins/ledger", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
  const take = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const rows = await prisma.coinLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take
  });
  return res.json({ ledger: rows });
});

const coinOrderCreateSchema = z.object({
  userId: z.string().min(1),
  packageId: z.string().min(1),
  paymentChannel: z.enum(["WECHAT", "ALIPAY"])
});

app.post("/coins/recharge/orders", async (req, res) => {
  try {
    const parsed = coinOrderCreateSchema.parse(req.body || {});
    const pkg = findCoinPackage(parsed.packageId);
    if (!pkg) return res.status(400).json({ message: "充值档位无效" });
    const user = await prisma.user.findUnique({ where: { id: parsed.userId }, select: { id: true } });
    if (!user) return res.status(404).json({ message: "用户不存在" });
    const order = await prisma.coinRechargeOrder.create({
      data: {
        userId: parsed.userId,
        packageId: pkg.id,
        coins: pkg.coins,
        amount: pkg.price,
        paymentChannel: parsed.paymentChannel
      }
    });
    return res.json({ order, package: pkg });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "参数错误" });
    }
    return res.status(400).json({ message: error.message || "创建订单失败" });
  }
});

app.post("/coins/recharge/orders/:orderId/pay", async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId) return res.status(400).json({ message: "订单号无效" });
    const userId = String(req.body?.userId || "").trim();
    if (!userId) return res.status(400).json({ message: "缺少 userId" });
    const paymentMode = String(req.body?.paymentMode || "mock").trim();
    if (paymentMode === "wechat_jsapi") {
      if (!isWechatPayConfigured()) {
        return res.status(503).json({ message: "微信支付未配置，请联系管理员" });
      }
      const order = await prisma.coinRechargeOrder.findUnique({ where: { id: orderId } });
      if (!order || order.userId !== userId) {
        return res.status(404).json({ message: "订单不存在或无权限" });
      }
      const payload = await createWechatJsapiPayment(
        "coin",
        order,
        userId,
        `盲盒星球金币充值 ${order.coins}`
      );
      return res.json(payload);
    }
    const result = await payCoinRechargeOrder(orderId, userId);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message || "支付失败" });
  }
});

app.post("/auth/wechat/bind", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    if (!isWechatMpConfigured()) {
      return res.status(503).json({ message: "微信小程序登录未配置" });
    }
    const code = String(req.body?.code || "").trim();
    const { openid } = await code2Session(code);
    const existing = await prisma.user.findUnique({ where: { wechatOpenId: openid } });
    if (existing && existing.id !== userId) {
      return res.status(409).json({ message: "该微信已绑定其他账号" });
    }
    await prisma.user.update({ where: { id: userId }, data: { wechatOpenId: openid } });
    return res.json({ ok: true, openidBound: true });
  } catch (error) {
    return res.status(400).json({ message: error.message || "微信绑定失败" });
  }
});

app.post("/payments/wechat/confirm", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const orderType = String(req.body?.orderType || "").trim();
    const orderId = String(req.body?.orderId || "").trim();
    if (!orderId || !["coin", "membership"].includes(orderType)) {
      return res.status(400).json({ message: "参数不完整" });
    }
    const outTradeNo = buildOutTradeNo(orderType, orderId);
    const tx = await queryTransactionByOutTradeNo(outTradeNo);
    if (tx.trade_state !== "SUCCESS") {
      return res.status(400).json({ message: "微信订单尚未支付成功", tradeState: tx.trade_state });
    }
    const result = await fulfillWechatPaidOrder(orderType, orderId, userId);
    return res.json({ ...result, confirmed: true });
  } catch (error) {
    return res.status(400).json({ message: error.message || "确认支付失败" });
  }
});

app.post("/payments/wechat/notify", async (req, res) => {
  try {
    const parsedNotify = parseWechatPayNotify(req.body);
    if (!parsedNotify.handled) {
      return res.status(200).json({ code: "SUCCESS", message: "OK" });
    }
    const { orderType, orderId } = parsedNotify.parsed;
    let userId = "";
    if (orderType === "membership") {
      const order = await prisma.membershipOrder.findUnique({ where: { id: orderId } });
      userId = order?.userId || "";
    } else {
      const order = await prisma.coinRechargeOrder.findUnique({ where: { id: orderId } });
      userId = order?.userId || "";
    }
    if (!userId) {
      return res.status(200).json({ code: "SUCCESS", message: "ORDER_NOT_FOUND" });
    }
    await fulfillWechatPaidOrder(orderType, orderId, userId);
    return res.status(200).json({ code: "SUCCESS", message: "OK" });
  } catch (error) {
    console.error("[payments/wechat/notify]", error);
    return res.status(500).json({ code: "FAIL", message: error.message || "FAIL" });
  }
});

app.post("/coins/recharge/orders/:orderId/cancel", async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId) return res.status(400).json({ message: "订单号无效" });
    const userId = String(req.body?.userId || "").trim();
    if (!userId) return res.status(400).json({ message: "缺少 userId" });
    const order = await cancelCoinRechargeOrder(orderId, userId);
    return res.json({ order });
  } catch (error) {
    return res.status(400).json({ message: error.message || "取消订单失败" });
  }
});

app.post("/membership/subscribe", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "").trim();
    const plan = String(req.body?.plan || "").trim();
    const paymentChannel = String(req.body?.paymentChannel || "WECHAT").trim();
    const parsed = membershipOrderCreateSchema.parse({ userId, plan, paymentChannel });
    const amount = MEMBERSHIP_PRICE[parsed.plan];
    const order = await prisma.membershipOrder.create({
      data: {
        userId: parsed.userId,
        plan: parsed.plan,
        paymentChannel: parsed.paymentChannel,
        amount
      }
    });
    const result = await payMembershipOrder(order.id, parsed.userId);
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "参数错误" });
    }
    return res.status(400).json({ message: error.message || "开通会员失败" });
  }
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
        avatar: normalizeAvatarUrl(item.avatarUrl) || "https://picsum.photos/80/80?chat",
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
          avatar: normalizeAvatarUrl(u.avatarUrl),
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
        avatar: normalizeAvatarUrl(r.fromUser.avatarUrl),
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

app.get("/users/:peerId/follow-status", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const peerId = String(req.params.peerId || "");
    if (!peerId || peerId === userId) return res.status(400).json({ message: "参数无效" });
    const peer = await prisma.user.findUnique({ where: { id: peerId }, select: { id: true } });
    if (!peer) return res.status(404).json({ message: "用户不存在" });
    const status = await getFollowStatus(userId, peerId);
    return res.json(status);
  } catch (_error) {
    return res.status(500).json({ message: "加载关注状态失败" });
  }
});

app.post("/users/:peerId/follow", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const peerId = String(req.params.peerId || "");
    if (!peerId || peerId === userId) return res.status(400).json({ message: "参数无效" });
    const peer = await prisma.user.findUnique({ where: { id: peerId }, select: { id: true } });
    if (!peer) return res.status(404).json({ message: "用户不存在" });
    await prisma.userFollow.upsert({
      where: { followerId_followeeId: { followerId: userId, followeeId: peerId } },
      update: {},
      create: { followerId: userId, followeeId: peerId }
    });
    const status = await syncFriendshipFromFollows(userId, peerId);
    return res.json({ ok: true, ...status, message: status.isFriend ? "已互相关注，已加入通讯录" : "关注成功" });
  } catch (_error) {
    return res.status(500).json({ message: "关注失败" });
  }
});

app.delete("/users/:peerId/follow", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const peerId = String(req.params.peerId || "");
    if (!peerId || peerId === userId) return res.status(400).json({ message: "参数无效" });
    await prisma.userFollow.deleteMany({
      where: { followerId: userId, followeeId: peerId }
    });
    const status = await syncFriendshipFromFollows(userId, peerId);
    return res.json({ ok: true, ...status, message: "已取消关注" });
  } catch (_error) {
    return res.status(500).json({ message: "取消关注失败" });
  }
});

app.post("/werewolf/match/enqueue", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });

    let existingMember = await prisma.werewolfRoomMember.findFirst({
      where: {
        userId,
        room: {
          type: "MATCH",
          status: { in: ["WAITING", "READY", "IN_GAME"] }
        }
      }
    });
    if (existingMember) {
      const payload = await getWerewolfRoomPayload(existingMember.roomId, userId);
      // Server restart may leave DB room status at IN_GAME while in-memory game is gone.
      // Treat this as stale and rematch immediately instead of returning an empty playing screen.
      if (payload?.type === "MATCH" && payload?.status === "IN_GAME" && !payload?.game) {
        await prisma.werewolfRoom.update({
          where: { id: existingMember.roomId },
          data: { status: "CLOSED" }
        });
        existingMember = null;
      }
    }
    if (existingMember) {
      const payload = await getWerewolfRoomPayload(existingMember.roomId, userId);
      return res.json({ ok: true, roomId: existingMember.roomId, matched: true, room: payload });
    }

    await prisma.werewolfMatchQueue.deleteMany({ where: { userId } });

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { gender: true }
    });
    if (!currentUser) return res.status(404).json({ message: "用户不存在" });
    const oppositeGender = currentUser.gender === "MALE" ? "FEMALE" : "MALE";
    const sameGender = currentUser.gender === "MALE" ? "MALE" : "FEMALE";
    const oppositeTarget = randomPick([3, 4]);
    const sameTarget = 5 - oppositeTarget;
    const [oppositeBots, sameBots] = await Promise.all([
      prisma.user.findMany({
        where: {
          phone: { startsWith: "fake" },
          id: { not: userId },
          gender: oppositeGender
        },
        take: 120
      }),
      prisma.user.findMany({
        where: {
          phone: { startsWith: "fake" },
          id: { not: userId },
          gender: sameGender
        },
        take: 120
      })
    ]);
    const pickedOpposite = shuffleList(oppositeBots).slice(0, oppositeTarget);
    const pickedSame = shuffleList(sameBots).slice(0, sameTarget);
    const bots = shuffleList([...pickedOpposite, ...pickedSame]).slice(0, 5);
    if (bots.length < 5) {
      return res.status(503).json({
        message: "符合性别配比的机器人账号不足，请先补充种子数据后重试"
      });
    }

    const room = await prisma.werewolfRoom.create({
      data: {
        type: "MATCH",
        status: "READY",
        ownerUserId: userId,
        maxSeats: 6,
        minStartPlayers: 6
      }
    });
    await prisma.werewolfRoomMember.createMany({
      data: [
        { roomId: room.id, userId, status: "HOST", invitedByUserId: null },
        ...bots.map((b) => ({
          roomId: room.id,
          userId: b.id,
          status: "ACCEPTED",
          invitedByUserId: userId
        }))
      ]
    });
    const started = await startWerewolfGame(room.id, userId);
    if (!started.ok) {
      return res.status(started.status || 500).json({ message: started.message || "开局失败" });
    }
    const startedRoom = started.room;
    const notifyIds = [userId, ...bots.map((b) => b.id)];
    emitWerewolfRoomUpdateToUsers(notifyIds, startedRoom);
    return res.json({ ok: true, matched: true, roomId: room.id, room: startedRoom });
  } catch (_error) {
    return res.status(500).json({ message: "匹配失败，请稍后重试" });
  }
});

app.get("/werewolf/match/status", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const member = await prisma.werewolfRoomMember.findFirst({
      where: {
        userId,
        room: {
          type: "MATCH",
          status: { in: ["WAITING", "READY", "IN_GAME"] }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!member) return res.json({ matched: false });
    let room = await getWerewolfRoomPayload(member.roomId, userId);
    if (room?.type === "MATCH" && room?.status === "IN_GAME" && !room?.game) {
      const started = await startWerewolfGame(member.roomId, userId);
      if (started.ok) room = started.room;
    }
    return res.json({ matched: true, roomId: member.roomId, room });
  } catch (_error) {
    return res.status(500).json({ message: "查询匹配状态失败" });
  }
});

app.post("/werewolf/session/reset", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });

    await prisma.werewolfMatchQueue.deleteMany({ where: { userId } });
    const activeMembers = await prisma.werewolfRoomMember.findMany({
      where: {
        userId,
        room: {
          status: { in: ["WAITING", "READY", "IN_GAME"] }
        }
      },
      include: {
        room: true
      }
    });

    for (const member of activeMembers) {
      const roomId = member.roomId;
      if (member.room.type === "MATCH") {
        await prisma.werewolfRoom.updateMany({
          where: { id: roomId, status: { in: ["WAITING", "READY", "IN_GAME"] } },
          data: { status: "CLOSED" }
        });
        werewolfGames.delete(roomId);
        clearWerewolfGameTimer(roomId);
      } else if (member.status !== "HOST") {
        await prisma.werewolfRoomMember.updateMany({
          where: {
            roomId,
            userId,
            status: { in: ["PENDING", "ACCEPTED"] }
          },
          data: { status: "DECLINED" }
        });
      } else {
        await prisma.werewolfRoom.updateMany({
          where: { id: roomId, status: { in: ["WAITING", "READY"] } },
          data: { status: "CLOSED" }
        });
      }
    }

    return res.json({ ok: true });
  } catch (_error) {
    return res.status(500).json({ message: "重置狼人杀会话失败" });
  }
});

app.post("/werewolf/rooms", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const room = await prisma.werewolfRoom.create({
      data: {
        type: "FRIEND",
        status: "WAITING",
        ownerUserId: userId,
        maxSeats: 12,
        minStartPlayers: 6
      }
    });
    await prisma.werewolfRoomMember.create({
      data: {
        roomId: room.id,
        userId,
        status: "HOST"
      }
    });
    const payload = await getWerewolfRoomPayload(room.id, userId);
    emitWerewolfRoomUpdateToUsers([userId], payload);
    return res.json({ room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "创建好友房失败" });
  }
});

app.get("/werewolf/rooms/:id", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    let room = await getWerewolfRoomPayload(req.params.id, userId);
    if (!room) return res.status(404).json({ message: "房间不存在" });
    if (room.type === "MATCH" && room.status === "IN_GAME" && !room.game) {
      const started = await startWerewolfGame(req.params.id, userId);
      if (started.ok) room = started.room;
    }
    const joined = room.members.some((m) => m.userId === userId);
    if (!joined) return res.status(403).json({ message: "你不在该房间中" });
    return res.json({ room });
  } catch (_error) {
    return res.status(500).json({ message: "拉取房间失败" });
  }
});

app.get("/werewolf/invitations", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const invites = await prisma.werewolfRoomMember.findMany({
      where: {
        userId,
        status: "PENDING",
        room: {
          type: "FRIEND",
          status: { in: ["WAITING", "READY"] }
        }
      },
      include: {
        room: {
          include: {
            owner: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json({
      invitations: invites.map((item) => ({
        roomId: item.roomId,
        ownerUserId: item.room.ownerUserId,
        ownerName: item.room.owner.nickname,
        ownerAvatar: normalizeAvatarUrl(item.room.owner.avatarUrl),
        status: item.status,
        createdAt: item.createdAt.toISOString()
      }))
    });
  } catch (_error) {
    return res.status(500).json({ message: "拉取邀请失败" });
  }
});

app.post("/werewolf/rooms/:id/invite", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const inviteeUserId = String(req.body.userId || "");
    if (!inviteeUserId || inviteeUserId === userId) return res.status(400).json({ message: "无效邀请对象" });
    const roomId = req.params.id;
    const room = await prisma.werewolfRoom.findUnique({ where: { id: roomId } });
    if (!room || room.type !== "FRIEND") return res.status(404).json({ message: "好友房不存在" });
    if (room.ownerUserId !== userId) return res.status(403).json({ message: "仅房主可邀请" });

    const hostMember = await prisma.werewolfRoomMember.findFirst({ where: { roomId, userId, status: "HOST" } });
    if (!hostMember) return res.status(403).json({ message: "你不是房主" });
    const memberCount = await prisma.werewolfRoomMember.count({ where: { roomId } });
    if (memberCount >= room.maxSeats) return res.status(400).json({ message: "房间已满（最多12人）" });

    const friendIds = new Set(await getFriendIds(userId));
    if (!friendIds.has(inviteeUserId)) return res.status(400).json({ message: "只能邀请你的好友" });

    await prisma.werewolfRoomMember.upsert({
      where: { roomId_userId: { roomId, userId: inviteeUserId } },
      update: { status: "PENDING", invitedByUserId: userId },
      create: { roomId, userId: inviteeUserId, status: "PENDING", invitedByUserId: userId }
    });
    const payload = await getWerewolfRoomPayload(roomId, userId);
    const inviter = await prisma.user.findUnique({ where: { id: userId } });
    const inviteSockets = userSockets.get(inviteeUserId);
    if (inviteSockets?.size) {
      inviteSockets.forEach((socketId) => {
        io.to(socketId).emit("werewolf:invite", {
          roomId,
          ownerName: inviter?.nickname || "好友",
          ownerAvatar: normalizeAvatarUrl(inviter?.avatarUrl)
        });
      });
    }
    emitWerewolfRoomUpdateToUsers(payload.members.map((m) => m.userId), payload);
    return res.json({ room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "邀请失败" });
  }
});

app.post("/werewolf/rooms/:id/respond", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const action = String(req.body.action || "").toUpperCase();
    if (!["ACCEPT", "DECLINE"].includes(action)) return res.status(400).json({ message: "无效操作" });
    const roomId = req.params.id;
    const member = await prisma.werewolfRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (!member) return res.status(404).json({ message: "你不在该房间内" });
    if (member.status === "HOST") return res.json({ ok: true });
    await prisma.werewolfRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { status: action === "ACCEPT" ? "ACCEPTED" : "DECLINED" }
    });
    const payload = await getWerewolfRoomPayload(roomId, userId);
    emitWerewolfRoomUpdateToUsers(payload.members.map((m) => m.userId), payload);
    return res.json({ room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "处理邀请失败" });
  }
});

app.post("/werewolf/rooms/:id/start", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const started = await startWerewolfGame(req.params.id, userId);
    if (!started.ok) {
      return res.status(started.status || 500).json({ message: started.message || "开局失败" });
    }
    return res.json({ room: started.room });
  } catch (_error) {
    return res.status(500).json({ message: "开局失败" });
  }
});

app.post("/werewolf/rooms/:id/action", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const roomId = req.params.id;
    const actionType = String(req.body.type || "").trim();
    const targetUserId = String(req.body.targetUserId || "");
    const text = String(req.body.text || "").trim();
    const game = werewolfGames.get(roomId);
    if (!game) return res.status(404).json({ message: "游戏未开始" });
    const me = game.players.find((p) => p.userId === userId);
    if (!me || !me.alive) return res.status(400).json({ message: "你当前无法操作" });

    if (actionType === "night-kill") {
      if (game.phase !== "NIGHT" || me.role !== "WOLF") return res.status(400).json({ message: "当前不可夜杀" });
      const target = game.players.find((p) => p.userId === targetUserId && p.alive && p.camp === "GOOD");
      if (!target) return res.status(400).json({ message: "目标无效" });
      game.nightKillTargetUserId = target.userId;
      game.logs.push(buildWerewolfLog(game, `${me.name} 已选择夜杀目标。`));
    } else if (actionType === "speak") {
      if (game.phase !== "DAY_SPEECH" || game.currentSpeakerUserId !== userId) {
        return res.status(400).json({ message: "当前不可发言" });
      }
      game.logs.push(buildWerewolfLog(game, `${me.name} 发言：${text || "我先过。"} `));
      advanceWerewolfSpeaker(game);
    } else if (actionType === "vote") {
      if (game.phase !== "DAY_VOTE") return res.status(400).json({ message: "当前不可投票" });
      const target = game.players.find((p) => p.userId === targetUserId && p.alive && p.userId !== userId);
      if (!target) return res.status(400).json({ message: "投票目标无效" });
      game.votes[userId] = target.userId;
      game.logs.push(buildWerewolfLog(game, `${me.name} 已完成投票。`));
    } else {
      return res.status(400).json({ message: "未知操作" });
    }
    await emitWerewolfGameUpdate(roomId);
    await scheduleWerewolfSimulation(roomId);
    const room = await getWerewolfRoomPayload(roomId, userId);
    return res.json({ room });
  } catch (_error) {
    return res.status(500).json({ message: "提交操作失败" });
  }
});

app.post("/tacit/match/enqueue", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { gender: true }
    });
    if (!currentUser) return res.status(401).json({ message: "未登录或登录态失效" });
    const topicCategory = normalizeTacitTopic(req.body?.topicCategory);
    const existingMember = await prisma.tacitRoomMember.findFirst({
      where: {
        userId,
        room: {
          type: "MATCH",
          status: { in: ["WAITING", "IN_PROGRESS"] }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    if (existingMember) {
      const room = await getTacitRoomPayload(existingMember.roomId);
      return res.json({ matched: true, roomId: existingMember.roomId, room });
    }
    await prisma.tacitMatchQueue.upsert({
      where: { userId },
      update: { topicCategory },
      create: { userId, topicCategory }
    });
    const targetGender = currentUser.gender === "MALE" ? "FEMALE" : "MALE";
    const queued = await prisma.tacitMatchQueue.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            gender: true
          }
        }
      },
      take: 100
    });
    const meInQueue = queued.find((item) => item.userId === userId) || null;
    const partnerInQueue =
      queued.find((item) => item.userId !== userId && item.user?.gender === targetGender) || null;
    if (!meInQueue || !partnerInQueue) return res.json({ matched: false, queuedCount: queued.length });
    const pair = [meInQueue, partnerInQueue].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const userIds = pair.map((q) => q.userId);
    const roomTopicCategory = normalizeTacitTopic(
      meInQueue.topicCategory || partnerInQueue.topicCategory
    );
    const room = await prisma.tacitRoom.create({
      data: {
        type: "MATCH",
        status: "IN_PROGRESS",
        ownerUserId: userIds[0],
        topicCategory: roomTopicCategory
      }
    });
    await prisma.tacitRoomMember.createMany({
      data: userIds.map((uid, idx) => ({
        roomId: room.id,
        userId: uid,
        status: idx === 0 ? "HOST" : "ACCEPTED",
        invitedByUserId: idx === 0 ? null : userIds[0]
      }))
    });
    await seedTacitQuestionsIfMissing(room.id);
    await prisma.tacitMatchQueue.deleteMany({ where: { userId: { in: userIds } } });
    const payload = await getTacitRoomPayload(room.id);
    emitTacitRoomUpdateToUsers(userIds, payload);
    scheduleTacitBotAnswer(room.id).catch(() => {});
    return res.json({ matched: true, roomId: room.id, room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "默契匹配失败，请稍后重试" });
  }
});

app.get("/tacit/match/status", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const member = await prisma.tacitRoomMember.findFirst({
      where: {
        userId,
        room: {
          type: "MATCH",
          status: { in: ["WAITING", "IN_PROGRESS"] }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!member) {
      const botRoom = await completeTacitMatchWithBotIfNeeded(userId);
      if (botRoom) return res.json({ matched: true, roomId: botRoom.id, room: botRoom });
      return res.json({ matched: false });
    }
    const room = await getTacitRoomPayload(member.roomId);
    return res.json({ matched: true, roomId: member.roomId, room });
  } catch (_error) {
    return res.status(500).json({ message: "查询默契匹配状态失败" });
  }
});

app.post("/tacit/match/cancel", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    await prisma.tacitMatchQueue.deleteMany({ where: { userId } });
    return res.json({ ok: true });
  } catch (_error) {
    return res.status(500).json({ message: "取消默契匹配失败" });
  }
});

app.post("/tacit/session/reset", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });

    await prisma.tacitMatchQueue.deleteMany({ where: { userId } });
    const activeMembers = await prisma.tacitRoomMember.findMany({
      where: {
        userId,
        room: {
          status: { in: ["WAITING", "IN_PROGRESS"] }
        }
      },
      select: { roomId: true }
    });
    const roomIds = [...new Set(activeMembers.map((item) => item.roomId).filter(Boolean))];
    for (const roomId of roomIds) {
      await prisma.tacitRoom.updateMany({
        where: {
          id: roomId,
          status: { in: ["WAITING", "IN_PROGRESS"] }
        },
        data: { status: "CLOSED" }
      });
      await prisma.tacitRoomMember.updateMany({
        where: {
          roomId,
          userId,
          status: { in: ["PENDING", "ACCEPTED"] }
        },
        data: { status: "DECLINED" }
      });
      const payload = await getTacitRoomPayload(roomId);
      if (payload) emitTacitRoomUpdateToUsers(payload.members.map((m) => m.userId), payload);
    }
    return res.json({ ok: true });
  } catch (_error) {
    return res.status(500).json({ message: "重置默契挑战会话失败" });
  }
});

app.post("/tacit/rooms", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const topicCategory = normalizeTacitTopic(req.body?.topicCategory);
    const room = await prisma.tacitRoom.create({
      data: {
        type: "FRIEND",
        status: "WAITING",
        ownerUserId: userId,
        topicCategory
      }
    });
    await prisma.tacitRoomMember.create({
      data: {
        roomId: room.id,
        userId,
        status: "HOST"
      }
    });
    const payload = await getTacitRoomPayload(room.id);
    emitTacitRoomUpdateToUsers([userId], payload);
    return res.json({ room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "创建默契挑战好友房失败" });
  }
});

app.get("/tacit/rooms/:id", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const room = await getTacitRoomPayload(req.params.id);
    if (!room) return res.status(404).json({ message: "房间不存在" });
    const joined = room.members.some((m) => m.userId === userId);
    if (!joined) return res.status(403).json({ message: "你不在该房间中" });
    return res.json({ room });
  } catch (_error) {
    return res.status(500).json({ message: "拉取默契挑战房间失败" });
  }
});

app.post("/tacit/rooms/:id/leave", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const roomId = req.params.id;
    const room = await prisma.tacitRoom.findUnique({
      where: { id: roomId },
      include: { members: true }
    });
    if (!room) return res.status(404).json({ message: "房间不存在" });
    const me = room.members.find((m) => m.userId === userId);
    if (!me) return res.status(403).json({ message: "你不在该房间中" });

    await prisma.tacitMatchQueue.deleteMany({ where: { userId } });
    if (!["FINISHED", "CLOSED"].includes(room.status)) {
      await prisma.tacitRoom.update({
        where: { id: roomId },
        data: { status: "CLOSED" }
      });
    }
    await prisma.tacitRoomMember.updateMany({
      where: {
        roomId,
        userId,
        status: { in: ["PENDING", "ACCEPTED"] }
      },
      data: { status: "DECLINED" }
    });

    const payload = await getTacitRoomPayload(roomId);
    if (payload) emitTacitRoomUpdateToUsers(payload.members.map((m) => m.userId), payload);
    return res.json({ ok: true, room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "退出默契挑战失败" });
  }
});

app.get("/tacit/invitations", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const invites = await prisma.tacitRoomMember.findMany({
      where: {
        userId,
        status: "PENDING",
        room: {
          type: "FRIEND",
          status: "WAITING"
        }
      },
      include: {
        room: {
          include: { owner: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json({
      invitations: invites.map((item) => ({
        roomId: item.roomId,
        ownerUserId: item.room.ownerUserId,
        ownerName: item.room.owner.nickname,
        ownerAvatar: normalizeAvatarUrl(item.room.owner.avatarUrl),
        status: item.status,
        createdAt: item.createdAt.toISOString()
      }))
    });
  } catch (_error) {
    return res.status(500).json({ message: "拉取默契挑战邀请失败" });
  }
});

app.post("/tacit/rooms/:id/invite", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const inviteeUserId = String(req.body.userId || "");
    if (!inviteeUserId || inviteeUserId === userId) return res.status(400).json({ message: "无效邀请对象" });
    const roomId = req.params.id;
    const room = await prisma.tacitRoom.findUnique({ where: { id: roomId } });
    if (!room || room.type !== "FRIEND") return res.status(404).json({ message: "好友房不存在" });
    if (room.ownerUserId !== userId) return res.status(403).json({ message: "仅房主可邀请" });
    const acceptedCount = await prisma.tacitRoomMember.count({
      where: { roomId, status: { in: ["HOST", "ACCEPTED"] } }
    });
    if (acceptedCount >= 2) return res.status(400).json({ message: "本局仅支持两名玩家" });
    const friendIds = new Set(await getFriendIds(userId));
    if (!friendIds.has(inviteeUserId)) return res.status(400).json({ message: "只能邀请你的好友" });
    await prisma.tacitRoomMember.upsert({
      where: { roomId_userId: { roomId, userId: inviteeUserId } },
      update: { status: "PENDING", invitedByUserId: userId },
      create: { roomId, userId: inviteeUserId, status: "PENDING", invitedByUserId: userId }
    });
    const payload = await getTacitRoomPayload(roomId);
    const inviter = await prisma.user.findUnique({ where: { id: userId } });
    const inviteSockets = userSockets.get(inviteeUserId);
    if (inviteSockets?.size) {
      inviteSockets.forEach((socketId) => {
        io.to(socketId).emit("tacit:invite", {
          roomId,
          ownerName: inviter?.nickname || "好友",
          ownerAvatar: normalizeAvatarUrl(inviter?.avatarUrl)
        });
      });
    }
    emitTacitRoomUpdateToUsers(payload.members.map((m) => m.userId), payload);
    return res.json({ room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "邀请失败" });
  }
});

app.post("/tacit/rooms/:id/respond", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const action = String(req.body.action || "").toUpperCase();
    if (!["ACCEPT", "DECLINE"].includes(action)) return res.status(400).json({ message: "无效操作" });
    const roomId = req.params.id;
    const member = await prisma.tacitRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (!member) return res.status(404).json({ message: "你不在该房间内" });
    if (member.status !== "HOST") {
      await prisma.tacitRoomMember.update({
        where: { roomId_userId: { roomId, userId } },
        data: { status: action === "ACCEPT" ? "ACCEPTED" : "DECLINED" }
      });
    }
    if (action === "ACCEPT") await seedTacitQuestionsIfMissing(roomId);
    const payload = await getTacitRoomPayload(roomId);
    emitTacitRoomUpdateToUsers(payload.members.map((m) => m.userId), payload);
    return res.json({ room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "处理邀请失败" });
  }
});

app.post("/tacit/rooms/:id/start", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const roomId = req.params.id;
    const room = await prisma.tacitRoom.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ message: "房间不存在" });
    if (room.ownerUserId !== userId) return res.status(403).json({ message: "仅房主可开始" });
    const acceptedCount = await prisma.tacitRoomMember.count({
      where: { roomId, status: { in: ["HOST", "ACCEPTED"] } }
    });
    if (acceptedCount < 2) return res.status(400).json({ message: "需要2名玩家同意后才能开始" });
    await seedTacitQuestionsIfMissing(roomId);
    await prisma.tacitRoom.update({ where: { id: roomId }, data: { status: "IN_PROGRESS" } });
    const payload = await getTacitRoomPayload(roomId);
    emitTacitRoomUpdateToUsers(payload.members.map((m) => m.userId), payload);
    return res.json({ room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "开始失败" });
  }
});

app.post("/tacit/rooms/:id/answer", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const roomId = req.params.id;
    const questionId = String(req.body.questionId || "");
    const choice = String(req.body.choice || "").toUpperCase();
    if (!questionId || !["A", "B"].includes(choice)) return res.status(400).json({ message: "参数不完整" });
    const member = await prisma.tacitRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (!member || !["HOST", "ACCEPTED"].includes(member.status)) {
      return res.status(403).json({ message: "你当前不可作答" });
    }
    const question = await prisma.tacitQuestion.findUnique({ where: { id: questionId } });
    if (!question || question.roomId !== roomId) return res.status(404).json({ message: "题目不存在" });
    await prisma.tacitAnswer.upsert({
      where: { questionId_userId: { questionId, userId } },
      update: { choice, answeredAt: new Date() },
      create: { roomId, questionId, memberId: member.id, userId, choice }
    });
    const payload = await getTacitRoomPayload(roomId);
    emitTacitRoomUpdateToUsers(payload.members.map((m) => m.userId), payload);
    scheduleTacitBotAnswer(roomId).catch(() => {});
    return res.json({ room: payload });
  } catch (_error) {
    return res.status(500).json({ message: "提交答案失败" });
  }
});

function normalizeAvatarUrl(url) {
  const normalized = normalizeChatMediaUrl(url);
  const raw = String(normalized ?? url ?? "").trim();
  if (!raw) return "";
  return normalizeSeedAvatarUrl(raw) || raw;
}

function normalizeMediaUrlList(urls) {
  if (!Array.isArray(urls)) return [];
  return urls.map((u) => normalizeAvatarUrl(u)).filter(Boolean);
}

function sanitizeUserMediaFields(user) {
  if (!user || typeof user !== "object") return user;
  const out = { ...user };
  if (out.avatarUrl != null && String(out.avatarUrl).trim()) {
    out.avatarUrl = normalizeAvatarUrl(out.avatarUrl);
  }
  if (out.photoUrls != null) {
    try {
      const parsed =
        typeof out.photoUrls === "string" ? JSON.parse(out.photoUrls || "[]") : out.photoUrls;
      if (Array.isArray(parsed)) {
        out.photoUrls = JSON.stringify(normalizeMediaUrlList(parsed));
      }
    } catch (_e) {
      /* keep original */
    }
  }
  return out;
}

/** 聊天媒体统一存相对路径，避免库里留下 localhost/127.0.0.1 等仅本机可访问的绝对 URL */
function normalizeChatMediaUrl(url) {
  if (url == null) return null;
  const s = String(url).trim();
  if (!s) return null;
  if (s.startsWith("/uploads/")) return s;
  if (s.startsWith("/oss-media/")) return s;
  try {
    const u = new URL(s);
    const path = u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    if (path.startsWith("/uploads/")) {
      return `${path}${u.search || ""}`;
    }
    const key = path.replace(/^\/+/, "");
    if (oss.isAllowedOssProxyKey(key)) {
      return `/oss-media/${key}${u.search || ""}`;
    }
    const pubBase = process.env.ALIYUN_OSS_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
    if (pubBase) {
      try {
        const base = new URL(pubBase.startsWith("http") ? pubBase : `https://${pubBase}`);
        if (u.host === base.host && oss.isAllowedOssProxyKey(key)) {
          return `/oss-media/${key}${u.search || ""}`;
        }
      } catch (_e2) {
        /* ignore */
      }
    }
  } catch (_e) {
    /* ignore */
  }
  return s;
}

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
        const previewThumbUrl =
          last.kind === "IMAGE" && (last.thumbMediaUrl || last.mediaUrl)
            ? normalizeAvatarUrl(normalizeChatMediaUrl(last.thumbMediaUrl || last.mediaUrl))
            : null;
        return {
          id: peer.id,
          name: peer.nickname,
          avatar: normalizeAvatarUrl(peer.avatarUrl) || "https://picsum.photos/80/80?chat",
          preview: previewText(last),
          previewThumbUrl,
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
        mediaUrl: item.mediaUrl ? normalizeAvatarUrl(item.mediaUrl) : null,
        thumbMediaUrl: item.thumbMediaUrl ? normalizeAvatarUrl(item.thumbMediaUrl) : null,
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
    const { toUserId, text, kind, mediaUrl, thumbMediaUrl, audioDurationSec } = req.body;
    const messageKind = ["TEXT", "IMAGE", "AUDIO"].includes(String(kind || "TEXT"))
      ? String(kind || "TEXT")
      : "TEXT";
    const content = String(text || "").trim();
    const normalizedMediaUrl = mediaUrl ? normalizeChatMediaUrl(String(mediaUrl)) : null;
    const normalizedThumbUrl =
      thumbMediaUrl && messageKind === "IMAGE" ? normalizeChatMediaUrl(String(thumbMediaUrl)) : null;
    if (!toUserId) {
      return res.status(400).json({ message: "参数不完整" });
    }
    if (messageKind === "TEXT" && !content) return res.status(400).json({ message: "文本内容不能为空" });
    if ((messageKind === "IMAGE" || messageKind === "AUDIO") && !normalizedMediaUrl) {
      return res.status(400).json({ message: "媒体消息缺少地址" });
    }
    let textToSave = content;
    let sensitiveFiltered = false;
    if (messageKind === "TEXT") {
      const prepared = prepareChatTextContent(content);
      if (!prepared.ok) return res.status(prepared.status).json({ message: prepared.message });
      textToSave = prepared.text;
      sensitiveFiltered = prepared.sensitiveFiltered;
    }
    const message = await prisma.chatMessage.create({
      data: {
        fromUserId: authUserId,
        toUserId: String(toUserId),
        kind: messageKind,
        text: messageKind === "TEXT" ? textToSave : "",
        mediaUrl: normalizedMediaUrl,
        thumbMediaUrl: messageKind === "IMAGE" ? normalizedThumbUrl || normalizedMediaUrl : null,
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
      mediaUrl: message.mediaUrl ? normalizeAvatarUrl(message.mediaUrl) : null,
      thumbMediaUrl: message.thumbMediaUrl ? normalizeAvatarUrl(message.thumbMediaUrl) : null,
      audioDurationSec: message.audioDurationSec,
      createdAt: message.createdAt.toISOString(),
      sensitiveFiltered
    };
    const targetSockets = userSockets.get(String(toUserId));
    if (targetSockets?.size) {
      targetSockets.forEach((socketId) => {
        io.to(socketId).emit("chat:message", payload);
      });
    }
    return res.json({ message: payload, sensitiveFiltered });
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

  let photoUrls = [];
  try {
    const parsed = JSON.parse(target.photoUrls || "[]");
    photoUrls = Array.isArray(parsed) ? parsed : [];
  } catch {
    photoUrls = [];
  }

  const momentRows = await prisma.squareMoment.findMany({
    where: { userId: target.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  const wealth = walletSnapshot(target);

  const giftWall = await prisma.giftTransaction.findMany({
    where: { toUserId: target.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      giftName: true,
      giftIcon: true,
      coinCost: true,
      createdAt: true,
      fromUser: { select: { id: true, nickname: true, avatarUrl: true } }
    }
  });

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
    industry: target.industry,
    income: target.income,
    avatarUrl: normalizeAvatarUrl(target.avatarUrl),
    wealthLevel: wealth.wealthLevel,
    wealthLevelName: wealth.wealthLevelName,
    contributionPoints: wealth.contributionPoints,
    charmValue: wealth.charmValue,
    giftWall: giftWall.map((row) => ({
      id: row.id,
      giftName: row.giftName,
      giftIcon: row.giftIcon,
      coinCost: row.coinCost,
      createdAt: row.createdAt.toISOString(),
      fromUser: {
        id: row.fromUser.id,
        nickname: row.fromUser.nickname,
        avatarUrl: normalizeAvatarUrl(row.fromUser.avatarUrl)
      }
    })),
    photoUrls: normalizeMediaUrlList(photoUrls),
    posts: momentRows.map((row) => ({
      id: row.id,
      text: row.text,
      likes: row.likes,
      imageUrls: normalizeMediaUrlList(safeParseMomentImageUrls(row.imageUrls)),
      createdAt: formatSquareMomentTime(row.createdAt)
    }))
  };
  return res.json({ profile: safeProfile });
});

/** 生产环境由 backend 统一托管前端 dist，CDN 只需回源 :4000（可通过 SERVE_FRONTEND=0 关闭） */
const backendRoot = path.dirname(fileURLToPath(import.meta.url));
const frontendDistDir = path.resolve(backendRoot, "../../frontend/dist");
const SPA_API_PREFIXES = [
  "/admin/api",
  "/auth",
  "/square",
  "/match",
  "/game",
  "/membership",
  "/wallet",
  "/points",
  "/gifts",
  "/coins",
  "/chat",
  "/friends",
  "/users",
  "/werewolf",
  "/tacit",
  "/planet",
  "/public",
  "/uploads",
  "/oss-media",
  "/health",
  "/socket.io"
];

/** 与 API 前缀同名、但由前端 React 接管的路径（刷新须返回 index.html） */
const SPA_PAGE_EXACT = new Set(["/planet", "/square", "/chat", "/me", "/match"]);

function isSpaPagePath(pathname) {
  if (SPA_PAGE_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/planet/games/")) return true;
  if (pathname.startsWith("/legal/")) return true;
  return false;
}

function isBackendApiPath(pathname) {
  if (isSpaPagePath(pathname)) return false;
  return SPA_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function mountWechatMpVerify() {
  const filename = String(process.env.WECHAT_MP_VERIFY_FILENAME || "").trim();
  const content = String(process.env.WECHAT_MP_VERIFY_CONTENT || "").trim();
  if (!filename || !content) return;
  if (!/^MP_verify_[A-Za-z0-9]+\.txt$/.test(filename)) {
    console.warn("[wechat] WECHAT_MP_VERIFY_FILENAME 格式无效，已跳过业务域名校验路由");
    return;
  }
  app.get(`/${filename}`, (_req, res) => {
    res.type("text/plain").send(content);
  });
  console.log(`[wechat] 业务域名校验文件: GET /${filename}`);
}

function mountFrontendStatic() {
  if (process.env.SERVE_FRONTEND === "0") return;
  const indexPath = path.join(frontendDistDir, "index.html");
  if (!fsSync.existsSync(indexPath)) {
    console.warn(`[frontend] dist 不存在，跳过静态托管: ${frontendDistDir}`);
    return;
  }
  app.use(
    express.static(frontendDistDir, {
      index: false,
      fallthrough: true,
      maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
    })
  );
  app.get("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (isBackendApiPath(req.path)) return next();
    return res.sendFile(indexPath, (err) => (err ? next(err) : undefined));
  });
  app.use((req, res) => {
    const p = req.path || "";
    if (p.startsWith("/uploads/") || p.startsWith("/oss-media/")) {
      return res.status(404).send("Not Found");
    }
    if ((req.method === "GET" || req.method === "HEAD") && req.accepts("html")) {
      return res.redirect(302, "/planet");
    }
    res.status(404).send("Not Found");
  });
  console.log(`[frontend] 静态托管: ${frontendDistDir}`);
}

mountWechatMpVerify();
mountFrontendStatic();

io.on("connection", (socket) => {
  const userId = String(socket.handshake.query.userId || "");
  if (!userId) {
    socket.disconnect(true);
    return;
  }
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);

  socket.on("chat:send", async ({ toUserId, text, kind, mediaUrl, thumbMediaUrl, audioDurationSec }) => {
    const messageKind = ["TEXT", "IMAGE", "AUDIO"].includes(String(kind || "TEXT"))
      ? String(kind || "TEXT")
      : "TEXT";
    const content = String(text || "").trim();
    const normalizedMediaUrl = mediaUrl ? normalizeChatMediaUrl(String(mediaUrl)) : null;
    const normalizedThumbUrl =
      thumbMediaUrl && messageKind === "IMAGE" ? normalizeChatMediaUrl(String(thumbMediaUrl)) : null;
    if (!toUserId) return;
    if (messageKind === "TEXT" && !content) return;
    if ((messageKind === "IMAGE" || messageKind === "AUDIO") && !normalizedMediaUrl) return;
    let textToSave = content;
    let sensitiveFiltered = false;
    if (messageKind === "TEXT") {
      const prepared = prepareChatTextContent(content);
      if (!prepared.ok) return;
      textToSave = prepared.text;
      sensitiveFiltered = prepared.sensitiveFiltered;
    }
    try {
      const message = await prisma.chatMessage.create({
        data: {
          fromUserId: userId,
          toUserId: String(toUserId),
          kind: messageKind,
          text: messageKind === "TEXT" ? textToSave : "",
          mediaUrl: normalizedMediaUrl,
          thumbMediaUrl: messageKind === "IMAGE" ? normalizedThumbUrl || normalizedMediaUrl : null,
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
        mediaUrl: message.mediaUrl ? normalizeAvatarUrl(message.mediaUrl) : null,
        thumbMediaUrl: message.thumbMediaUrl ? normalizeAvatarUrl(message.thumbMediaUrl) : null,
        audioDurationSec: message.audioDurationSec,
        createdAt: message.createdAt.toISOString(),
        sensitiveFiltered
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
// 0.0.0.0 才能从公网/其他机器访问；仅本机可设 HOST=127.0.0.1
const host = process.env.HOST || "0.0.0.0";
ensureDefaultUsers()
  .catch((error) => {
    console.error("failed to ensure default users", error);
  })
  .finally(() => {
    httpServer.listen(port, host, () => {
      console.log(`API running: http://${host}:${port}`);
    });
  });
