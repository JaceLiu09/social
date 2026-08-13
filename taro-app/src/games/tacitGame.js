export const TACIT_ROUNDS_PER_GAME = 10;

export const TACIT_TOPIC_META = [
  { id: "social", label: "暧昧社交", desc: "撩人分寸、心动试探", emoji: "😏" },
  { id: "life", label: "私密生活", desc: "独处想象、夜晚状态", emoji: "🌙" },
  { id: "love", label: "亲密心动", desc: "身体靠近、关系升温", emoji: "🔥" },
  { id: "fun", label: "氛围娱乐", desc: "暧昧片单、深夜消遣", emoji: "🍷" },
  { id: "mixed", label: "随机混合", desc: "每题随机主题", emoji: "🎲" }
];

export const TACIT_TOPIC_POOL = ["social", "life", "love", "fun"];

export function getTacitTopicMeta(topicId) {
  return TACIT_TOPIC_META.find((item) => item.id === topicId) || TACIT_TOPIC_META[0];
}

export function getTacitTopicLabel(topicId) {
  return getTacitTopicMeta(topicId).label;
}
