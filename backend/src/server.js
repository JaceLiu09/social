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
import { sampleTacitQuestionsForRound } from "./tacitQuestionBank.js";
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
      avatar: m.user.avatarUrl || "",
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
      const target =
        game.nightKillTargetUserId && goodTargets.some((p) => p.userId === game.nightKillTargetUserId)
          ? game.players.find((p) => p.userId === game.nightKillTargetUserId)
          : randomPick(goodTargets);
      if (target) {
        target.alive = false;
        game.logs.push(buildWerewolfLog(game, `夜晚结束，${target.name} 出局。`));
      }
      game.nightKillTargetUserId = "";
      game.phase = "DAY_SPEECH";
      game.currentSpeakerOrder = shuffleList(game.players.filter((p) => p.alive).map((p) => p.userId));
      game.currentSpeakerIndex = 0;
      game.currentSpeakerUserId = game.currentSpeakerOrder[0] || "";
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
      game.currentSpeakerUserId = "";
      game.votes = {};
      game.logs.push(buildWerewolfLog(game, "发言结束，进入公投环节。"));
      await emitWerewolfGameUpdate(roomId);
      await scheduleWerewolfSimulation(roomId);
      return;
    }
    const currentSpeaker = game.currentSpeakerOrder[game.currentSpeakerIndex];
    game.currentSpeakerUserId = currentSpeaker;
    if (currentSpeaker === game.humanUserId) {
      await emitWerewolfGameUpdate(roomId);
      return;
    }
    const timer = setTimeout(async () => {
      const speaker = game.players.find((p) => p.userId === currentSpeaker);
      if (speaker?.alive) {
        const snippets = ["我先观察一下。", "我这轮是好人视角。", "先听后面玩家发言。", "这轮发言偏保守。"];
        game.logs.push(buildWerewolfLog(game, `${speaker.name} 发言：${randomPick(snippets)}`));
      }
      game.currentSpeakerIndex += 1;
      game.currentSpeakerUserId = game.currentSpeakerOrder[game.currentSpeakerIndex] || "";
      await emitWerewolfGameUpdate(roomId);
      await scheduleWerewolfSimulation(roomId);
    }, 1200);
    werewolfGameTimers.set(roomId, timer);
    return;
  }

  if (game.phase === "DAY_VOTE") {
    const alive = game.players.filter((p) => p.alive);
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
    const humanAlive = alive.some((p) => p.userId === game.humanUserId);
    if (humanAlive && !game.votes[game.humanUserId]) {
      await emitWerewolfGameUpdate(roomId);
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
    game.logs.push(buildWerewolfLog(game, `第 ${game.day} 夜开始，狼人请选择目标。`));
    await emitWerewolfGameUpdate(roomId);
    await scheduleWerewolfSimulation(roomId);
  }
}

async function seedTacitQuestionsIfMissing(roomId) {
  const exists = await prisma.tacitQuestion.count({ where: { roomId } });
  if (exists > 0) return;
  const questions = sampleTacitQuestionsForRound({ icebreakerCount: 5, valueCount: 5 });
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

function getTacitBotDelayMs(userId) {
  const seed = Array.from(String(userId || "")).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return 2000 + (seed % 5) * 1000; // 2s~6s
}

async function completeTacitMatchWithBotIfNeeded(userId) {
  const queueEntry = await prisma.tacitMatchQueue.findUnique({ where: { userId } });
  if (!queueEntry) return null;
  const waitedMs = Date.now() - new Date(queueEntry.createdAt).getTime();
  if (waitedMs < getTacitBotDelayMs(userId)) return null;

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

  const room = await prisma.tacitRoom.create({
    data: {
      type: "MATCH",
      status: "IN_PROGRESS",
      ownerUserId: userId
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
    acceptedCount: acceptedMembers.length,
    questionCount: room.questions.length,
    finishedCount,
    score,
    members: room.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.nickname,
      avatar: m.user.avatarUrl || "",
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
  const unansweredMember = activeMembers.find((m) => !currentQuestion.answers.some((a) => a.userId === m.userId));
  if (!unansweredMember) return;

  const botMember = room.members.find((m) => m.id === unansweredMember.id) || unansweredMember;
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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(existingPhones, prefix = "19") {
  let phone = "";
  do {
    if (prefix.startsWith("fake")) {
      const suffix = String(randomInt(0, 99999999)).padStart(8, "0");
      phone = `${prefix}${suffix}`;
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
    income: "8k-15k",
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
      .map((name) => `/avatars/${folder}/${name}`);
  } catch (_error) {
    return [];
  }
}

function buildFakeBotUser({ index, gender, avatarUrls, existingPhones }) {
  const male = gender === "MALE";
  const cityPool = ["上海", "深圳", "广州", "杭州", "成都", "北京", "重庆", "南京"];
  const hometownPool = ["苏州", "武汉", "西安", "长沙", "青岛", "郑州", "厦门", "天津"];
  const incomes = ["6k-10k", "8k-15k", "10k-20k", "15k-25k"];
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
    photoUrls: JSON.stringify([avatar])
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

  const [maleAvatarUrls, femaleAvatarUrls] = await Promise.all([
    loadAvatarUrlsByFolder("male"),
    loadAvatarUrlsByFolder("female")
  ]);
  const existingFakeBots = await prisma.user.findMany({
    where: {
      OR: [{ phone: { startsWith: "fakem" } }, { phone: { startsWith: "fakef" } }]
    },
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

app.post("/werewolf/match/enqueue", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });

    const existingMember = await prisma.werewolfRoomMember.findFirst({
      where: {
        userId,
        room: { status: { in: ["WAITING", "READY", "IN_GAME"] } }
      }
    });
    if (existingMember) {
      const payload = await getWerewolfRoomPayload(existingMember.roomId, userId);
      return res.json({ ok: true, roomId: existingMember.roomId, matched: true, room: payload });
    }

    await prisma.werewolfMatchQueue.deleteMany({ where: { userId } });

    const botCandidates = await prisma.user.findMany({
      where: {
        phone: { startsWith: "fake" },
        id: { not: userId }
      },
      take: 80
    });
    const bots = shuffleList(botCandidates).slice(0, 5);
    if (bots.length < 5) {
      return res.status(503).json({
        message: "机器人账号不足，请先在服务器执行种子数据或稍后重试"
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
    const payload = await getWerewolfRoomPayload(room.id, userId);
    const notifyIds = [userId, ...bots.map((b) => b.id)];
    emitWerewolfRoomUpdateToUsers(notifyIds, payload);
    return res.json({ ok: true, matched: true, roomId: room.id, room: payload });
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
        room: { status: { in: ["WAITING", "READY", "IN_GAME"] } }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!member) return res.json({ matched: false });
    const room = await getWerewolfRoomPayload(member.roomId, userId);
    return res.json({ matched: true, roomId: member.roomId, room });
  } catch (_error) {
    return res.status(500).json({ message: "查询匹配状态失败" });
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
    const room = await getWerewolfRoomPayload(req.params.id, userId);
    if (!room) return res.status(404).json({ message: "房间不存在" });
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
        ownerAvatar: item.room.owner.avatarUrl || "",
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
          ownerAvatar: inviter?.avatarUrl || ""
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
    const roomId = req.params.id;
    const room = await prisma.werewolfRoom.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ message: "房间不存在" });
    if (room.type === "FRIEND" && room.ownerUserId !== userId) return res.status(403).json({ message: "仅房主可开局" });
    const payload = await getWerewolfRoomPayload(roomId, userId);
    if (!payload) return res.status(404).json({ message: "房间不存在" });
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
      if (players.length < 6) return res.status(400).json({ message: "匹配玩家不足，稍后再试" });
    } else {
      if (players.length < 6) return res.status(400).json({ message: "至少6名玩家同意后才能开始" });
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
      nightKillTargetUserId: "",
      votes: {}
    };
    game.logs.push(buildWerewolfLog(game, "游戏开始，天黑请闭眼。"));
    werewolfGames.set(roomId, game);
    await prisma.werewolfRoom.update({ where: { id: roomId }, data: { status: "IN_GAME" } });
    await emitWerewolfGameUpdate(roomId);
    const next = await getWerewolfRoomPayload(roomId, userId);
    scheduleWerewolfSimulation(roomId).catch(() => {});
    return res.json({ room: next });
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
      game.currentSpeakerIndex += 1;
      game.currentSpeakerUserId = game.currentSpeakerOrder[game.currentSpeakerIndex] || "";
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
      update: {},
      create: { userId }
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
    const room = await prisma.tacitRoom.create({
      data: {
        type: "MATCH",
        status: "IN_PROGRESS",
        ownerUserId: userIds[0]
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
    const room = await prisma.tacitRoom.create({
      data: {
        type: "FRIEND",
        status: "WAITING",
        ownerUserId: userId
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
        ownerAvatar: item.room.owner.avatarUrl || "",
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
          ownerAvatar: inviter?.avatarUrl || ""
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

app.get("/chat/conversations", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "未登录或登录态失效" });
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) return res.status(404).json({ message: "用户不存在" });

    // Only peers with real messages (not "every other user in DB") — avoids rows where
    // preview/time looked like another person's thread and caused confusion.
    const friendIds = new Set(await getFriendIds(userId));
    if (!friendIds.size) return res.json({ conversations: [] });
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
      if (!friendIds.has(peerId)) continue;
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
    const friendIds = new Set(await getFriendIds(userId));
    if (!friendIds.has(peerId)) return res.json({ messages: [] });
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
    const friendIds = new Set(await getFriendIds(userId));
    if (!friendIds.has(String(peerId))) return res.json({ ok: true });
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
