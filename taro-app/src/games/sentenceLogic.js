import { SENTENCE_CHAIN_BANK, SENTENCE_TOPIC_META } from "./sentenceQuestionBank";
import { sampleItems } from "./shared";

export { SENTENCE_TOPIC_META, SENTENCE_CHAIN_BANK };

export function createSentenceChainRounds(count = 5, category = "date") {
  const pool = SENTENCE_CHAIN_BANK.filter((item) => item.category === category);
  const source = pool.length >= count ? pool : SENTENCE_CHAIN_BANK;
  return sampleItems(source, count).map((item, idx) => ({
    id: `sentence-round-${category}-${idx + 1}`,
    stem: item.stem,
    options: item.options,
    category: item.category
  }));
}

export function getSentenceTopicLabel(categoryId) {
  return SENTENCE_TOPIC_META.find((item) => item.id === categoryId)?.label || "综合题库";
}

export function getSentenceTopicMeta(categoryId) {
  return SENTENCE_TOPIC_META.find((item) => item.id === categoryId) || SENTENCE_TOPIC_META[0];
}

export function resolveSentencePeerChoice(myChoice, options, isBot) {
  const randomFallback = options[Math.floor(Math.random() * options.length)] || "";
  const matchBias = isBot ? 0.55 : 0.5;
  if (Math.random() < matchBias) return myChoice;
  if (randomFallback === myChoice && options.length > 1) {
    return options.find((item) => item !== myChoice) || randomFallback;
  }
  return randomFallback;
}
