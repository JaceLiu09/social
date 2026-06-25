export const COMMON_GROUND_ROUNDS = 5;
export const COMMON_GROUND_MAX_PICK = 3;
export const COMMON_GROUND_POINTS_PER_MATCH = 10;
export const COMMON_GROUND_REVEAL_MS = 3000;

export const COMMON_GROUND_TOPIC_META = [
  { id: "social", label: "暧昧社交", desc: "撩人分寸、心动试探", emoji: "😏" },
  { id: "life", label: "私密生活", desc: "独处想象、夜晚状态", emoji: "🌙" },
  { id: "love", label: "亲密心动", desc: "身体靠近、关系升温", emoji: "🔥" },
  { id: "fun", label: "氛围娱乐", desc: "暧昧片单、深夜消遣", emoji: "🍷" }
];

import { COMMON_GROUND_BANK } from "./commonGroundQuestionBank.js";

export { COMMON_GROUND_BANK };

function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function getCommonGroundTopicMeta(categoryId) {
  return COMMON_GROUND_TOPIC_META.find((item) => item.id === categoryId) || COMMON_GROUND_TOPIC_META[0];
}

export function getCommonGroundTopicLabel(categoryId) {
  return getCommonGroundTopicMeta(categoryId).label;
}

export function createCommonGroundRounds(count = COMMON_GROUND_ROUNDS, categoryId = "love") {
  const pool = COMMON_GROUND_BANK.filter((item) => item.category === categoryId);
  const source = pool.length >= count ? pool : COMMON_GROUND_BANK;
  return shuffle(source).slice(0, count);
}

export function countOverlap(left = [], right = []) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

export function scoreCommonGroundRound(myPicks = [], peerPicks = []) {
  return countOverlap(myPicks, peerPicks).length * COMMON_GROUND_POINTS_PER_MATCH;
}

export function simulateCommonGroundBotPicks(userPicks = [], options = [], isBot = true) {
  const pool = [...options];
  const pickCount = 1 + Math.floor(Math.random() * COMMON_GROUND_MAX_PICK);
  const picks = [];
  const overlapBias = isBot ? 0.62 : 0.48;

  for (const item of shuffle(userPicks)) {
    if (picks.length >= pickCount) break;
    if (Math.random() < overlapBias) picks.push(item);
  }

  for (const item of shuffle(pool)) {
    if (picks.length >= pickCount) break;
    if (!picks.includes(item)) picks.push(item);
  }

  return picks.slice(0, pickCount);
}

export function formatCommonGroundRoundLog(roundIndex, myPicks, peerPicks, overlap, gained) {
  const overlapText = overlap.length ? `共同点：${overlap.join("、")}` : "暂无共同点";
  return `第 ${roundIndex + 1} 题：你选 ${myPicks.join("、")}；对方选 ${peerPicks.join("、")}。${overlapText}${gained ? `，+${gained}` : ""}`;
}
