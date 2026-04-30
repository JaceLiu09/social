const ICEBREAKER_CONTEXT_PROMPTS = [
  "第一次见面破冰你更会选哪种方式？",
  "周末两人独处你更想怎么安排？",
  "约会当天你更在意哪一部分？",
  "一起旅行时你更偏向哪种节奏？",
  "发生分歧时你更希望对方怎么做？",
  "聊天冷场时你会更想怎么救场？",
  "纪念日当天你更期待哪种体验？",
  "深夜聊天时你更容易被哪种状态打动？",
  "工作压力大时你更希望收到哪种支持？",
  "感情升温阶段你更看重哪种信号？",
  "第一次吵架后你更想要哪种修复方式？",
  "雨天约会你更想选哪种活动？",
  "节假日排计划你更偏好哪种风格？",
  "一起看电影时你更想选哪一类体验？",
  "出门前准备你更愿意把时间花在哪？",
  "关系稳定后你更看重哪种日常感受？"
];

const VALUE_CONTEXT_PROMPTS = [
  "共同生活设想里你更偏向哪种模式？",
  "谈未来规划时你更先聊哪一块？",
  "两个人都很忙时你更想优先保留什么？",
  "朋友聚会场合里你更希望另一半怎么表现？",
  "突发小情绪时你更想先做哪件事？",
  "在社交平台互动时你更喜欢哪种风格？",
  "见家长前你更担心哪件事？",
  "计划一场短途旅行你更先决定什么？",
  "长期相处中你更愿意坚持哪种习惯？",
  "遇到选择困难时你更常用哪种方式决策？"
];

const OPTION_PAIRS = [
  { scene: "约会地点", optionA: "安静咖啡馆", optionB: "热闹夜市" },
  { scene: "聊天方式", optionA: "直接表达", optionB: "委婉暗示" },
  { scene: "休闲活动", optionA: "宅家追剧", optionB: "出门走走" },
  { scene: "旅行节奏", optionA: "详细规划", optionB: "随性出发" },
  { scene: "餐饮偏好", optionA: "尝试新店", optionB: "回访老店" },
  { scene: "沟通时间", optionA: "当天说清", optionB: "冷静后再聊" },
  { scene: "惊喜方式", optionA: "准备礼物", optionB: "安排体验" },
  { scene: "陪伴状态", optionA: "高频联系", optionB: "稳定低频" },
  { scene: "出行方式", optionA: "公共交通", optionB: "打车直达" },
  { scene: "拍照偏好", optionA: "自然抓拍", optionB: "精致摆拍" },
  { scene: "消费观念", optionA: "计划消费", optionB: "体验优先" },
  { scene: "日程安排", optionA: "早起出门", optionB: "晚点慢玩" },
  { scene: "居家氛围", optionA: "整洁极简", optionB: "温馨丰富" },
  { scene: "社交边界", optionA: "圈子融合", optionB: "保留独立" },
  { scene: "表达爱意", optionA: "语言肯定", optionB: "行动照顾" },
  { scene: "冲突修复", optionA: "先拥抱和好", optionB: "先讲清逻辑" },
  { scene: "节日安排", optionA: "两人独处", optionB: "朋友同聚" },
  { scene: "运动选择", optionA: "户外徒步", optionB: "室内健身" },
  { scene: "音乐口味", optionA: "循环老歌", optionB: "追新歌单" },
  { scene: "工作日约会", optionA: "下班散步", optionB: "晚餐看展" },
  { scene: "周末午后", optionA: "读书喝茶", optionB: "探店拍照" },
  { scene: "生活记录", optionA: "写日记", optionB: "发照片" },
  { scene: "家务分配", optionA: "固定分工", optionB: "谁有空谁做" },
  { scene: "理财方式", optionA: "稳健储蓄", optionB: "适度投资" }
];

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildTacitQuestionBankByType(contextPrompts, type, minCountPerType) {
  const bank = [];
  const seen = new Set();

  for (const context of contextPrompts) {
    for (const pair of OPTION_PAIRS) {
      const prompt = `${context}（${pair.scene}）`;
      const key = `${prompt}|${pair.optionA}|${pair.optionB}`;
      if (seen.has(key)) continue;
      seen.add(key);
      bank.push({
        prompt,
        optionA: pair.optionA,
        optionB: pair.optionB,
        type
      });
      if (bank.length >= minCountPerType) return bank;
    }
  }
  return bank;
}

const ICEBREAKER_BANK = buildTacitQuestionBankByType(ICEBREAKER_CONTEXT_PROMPTS, "ICEBREAKER", 260);
const VALUE_BANK = buildTacitQuestionBankByType(VALUE_CONTEXT_PROMPTS, "VALUE", 260);

export const TACIT_CHALLENGE_QUESTION_BANK = [...ICEBREAKER_BANK, ...VALUE_BANK];

export function sampleTacitQuestionsForRound({
  icebreakerCount = 5,
  valueCount = 5
} = {}) {
  const firstHalf = shuffle(ICEBREAKER_BANK).slice(0, icebreakerCount);
  const secondHalf = shuffle(VALUE_BANK).slice(0, valueCount);
  return [...firstHalf, ...secondHalf];
}
