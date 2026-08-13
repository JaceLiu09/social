import { TRUTH_CHALLENGE_BANK, TRUTH_STYLE_OPTIONS, TRUTH_STYLE_POOL, getTruthStyleMeta } from "./truthQuestionBank";
import { sampleItems } from "./shared";

export { TRUTH_STYLE_OPTIONS, getTruthStyleMeta };

export const TRUTH_ROUNDS_PER_GAME = 5;

export function createTruthRounds(count = TRUTH_ROUNDS_PER_GAME, styleId = "FLIRT") {
  const pool =
    styleId === "MIXED"
      ? TRUTH_CHALLENGE_BANK
      : TRUTH_CHALLENGE_BANK.filter((item) => item.difficulty === styleId);
  const source = pool.length >= count ? pool : TRUTH_CHALLENGE_BANK;
  return sampleItems(source, count).map((item, idx) => ({
    id: `truth-round-${idx + 1}`,
    question: item.question,
    options: item.options,
    difficulty: item.difficulty
  }));
}

export function rollTruthDice() {
  const diceA = 1 + Math.floor(Math.random() * 6);
  const diceB = 1 + Math.floor(Math.random() * 6);
  const meLose = diceA < diceB;
  return { diceA, diceB, meLose, winner: meLose ? "peer" : "me" };
}

export function pickTruthStyleForRound(styleId) {
  if (styleId === "MIXED") {
    return TRUTH_STYLE_POOL[Math.floor(Math.random() * TRUTH_STYLE_POOL.length)];
  }
  return styleId;
}
