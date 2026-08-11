/**
 * 聊天敏感词库（参考陌陌/探探等陌生人社交平台的常见审核维度，非官方词库）
 *
 * 大厂通常还有：变体识别（微❤、v信）、拼音、拆字、NLP 语义模型、图片 OCR 等。
 * 本项目为关键词匹配 + 等长 * 替换；可按类目扩展，或通过 SENSITIVE_WORDS_EXTRA 追加。
 */

/** @type {string[]} */
const WORDS_PROFANITY = [
  "傻逼",
  "傻B",
  "傻b",
  "煞笔",
  "沙比",
  "草泥马",
  "操你妈",
  "操你",
  "日你",
  "干你",
  "去死",
  "杀了你",
  "弄死你",
  "妈的",
  "他妈",
  "尼玛",
  "你妹",
  "滚蛋",
  "废物",
  "人渣",
  "贱人",
  "婊子",
  "狗东西",
  "畜生",
  "智障",
  "脑瘫",
  "去你妈",
  "草你妈",
  "fuck",
  "shit",
  "bitch"
];

/** 色情招嫖、低俗引流（陌陌规范：淫秽色情、低俗社交） */
const WORDS_SEXUAL = [
  "约炮",
  "约P",
  "yp",
  "裸聊",
  "裸照",
  "发裸照",
  "色图",
  "黄图",
  "黄片",
  "色情",
  "成人片",
  "A片",
  "av片",
  "开房",
  "一夜情",
  "炮友",
  "床上",
  "做爱",
  "上床",
  "嫖娼",
  "卖淫",
  "援交",
  "包养",
  "特殊服务",
  "上门服务",
  "兼职妹子",
  "小姐",
  "出台",
  "楼凤",
  "外围",
  "看片",
  "福利视频",
  "私密视频",
  "想看你",
  "发骚",
  "骚货",
  "湿了吗",
  "硬了",
  "撸管",
  "自慰",
  "口交",
  "肛交",
  "3p",
  "群p"
];

/** 导流私域（探探/陌陌重点打击：绕过平台加微信/QQ） */
const WORDS_CONTACT_DIVERSION = [
  "加微信",
  "加我微信",
  "私加微信",
  "加wx",
  "加Wx",
  "加VX",
  "加vx",
  "加v",
  "加V",
  "威信",
  "薇信",
  "微❤",
  "➕微信",
  "微信号",
  "wx号",
  "wxid",
  "qq号",
  "加qq",
  "加QQ",
  "扣扣",
  "电报",
  "telegram",
  "纸飞机",
  "私我",
  "私聊我",
  "线下见",
  "见面聊",
  "出来玩",
  "酒店见",
  "发定位",
  "手机号码",
  "手机号",
  "留个电话",
  "抖音号",
  "小红书号",
  "instagram",
  "whatsapp"
];

/** 诈骗、黑产、广告（陌陌规范：欺诈性社交、公民信息） */
const WORDS_SCAM = [
  "刷单",
  "兼职刷单",
  "日赚",
  "日入",
  "躺赚",
  "零投资",
  "稳赚",
  "高收益",
  "投资理财",
  "内部消息",
  "带单",
  "荐股",
  "股票群",
  "彩票",
  "时时彩",
  "网赚",
  "打字兼职",
  "点赞赚钱",
  "验证码发我",
  "银行卡",
  "信用卡套现",
  "贷款",
  "无抵押",
  "套现",
  "转账",
  "汇款",
  "支付宝",
  "花呗套现",
  "买卖号",
  "卖号",
  "买号",
  "陌陌号",
  "陌陌币",
  "私下交易",
  "公民信息",
  "个人信息出售",
  "定位他人",
  "查开房",
  "破解微信",
  "外挂",
  "代练",
  "刷粉",
  "刷赞"
];

/** 赌博 */
const WORDS_GAMBLING = [
  "赌博",
  "网赌",
  "博彩",
  "赌场",
  "百家乐",
  "德州扑克",
  "赌球",
  "押注",
  "下注",
  "六合彩",
  "时时彩",
  "北京赛车",
  "菠菜",
  "AG真人",
  "棋牌平台"
];

/** 违禁品 */
const WORDS_DRUGS = [
  "毒品",
  "冰毒",
  "大麻",
  "海洛因",
  "K粉",
  "摇头丸",
  "麻古",
  "可卡因",
  "致幻剂",
  "迷药",
  "听话水",
  "乖乖水",
  "迷奸"
];

/** 暴力、自残 */
const WORDS_VIOLENCE = [
  "自杀",
  "自残",
  "割腕",
  "炸弹",
  "炸药",
  "买枪",
  "枪支",
  "管制刀具",
  "恐怖袭击",
  "人肉",
  "曝光你",
  "住址"
];

/** 未成年人 */
const WORDS_MINOR = [
  "未成年",
  "小学生",
  "初中生",
  "萝莉",
  "正太",
  "幼女",
  "幼童",
  "开盒"
];

/** 涉政红线（合规必备；完整库需对接监管/第三方，此处仅示例高频） */
const WORDS_POLITICAL = [
  "习近平",
  "共产党",
  "六四",
  "法轮功",
  "台独",
  "藏独",
  "疆独",
  "港独",
  "反动",
  "颠覆国家"
];

const DEFAULT_SENSITIVE_WORDS = [
  ...WORDS_PROFANITY,
  ...WORDS_SEXUAL,
  ...WORDS_CONTACT_DIVERSION,
  ...WORDS_SCAM,
  ...WORDS_GAMBLING,
  ...WORDS_DRUGS,
  ...WORDS_VIOLENCE,
  ...WORDS_MINOR,
  ...WORDS_POLITICAL
];

let cachedWords = null;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadSensitiveWords() {
  if (cachedWords) return cachedWords;
  const extra = String(process.env.SENSITIVE_WORDS_EXTRA || "")
    .split(/[,，]/)
    .map((w) => w.trim())
    .filter(Boolean);
  const merged = [...DEFAULT_SENSITIVE_WORDS, ...extra];
  cachedWords = [...new Set(merged)].sort((a, b) => b.length - a.length);
  return cachedWords;
}

/** 当前加载的词数量（便于运维确认） */
export function getSensitiveWordCount() {
  return loadSensitiveWords().length;
}

/**
 * 检测并屏蔽敏感词：命中词替换为等长 *，返回是否发生过屏蔽。
 * @param {string} input
 * @returns {{ text: string, filtered: boolean, matches: string[] }}
 */
export function sanitizeChatText(input) {
  const original = String(input ?? "");
  if (!original) return { text: "", filtered: false, matches: [] };

  let text = original;
  const matches = [];
  for (const word of loadSensitiveWords()) {
    if (!word) continue;
    const re = new RegExp(escapeRegExp(word), "gi");
    if (!re.test(text)) continue;
    matches.push(word);
    text = text.replace(new RegExp(escapeRegExp(word), "gi"), (hit) => "*".repeat(hit.length));
  }

  return {
    text,
    filtered: text !== original,
    matches: [...new Set(matches)]
  };
}

/** 供 HTTP 接口使用：trim + 屏蔽；空文本视为无效 */
export function prepareChatTextContent(rawText) {
  const trimmed = String(rawText ?? "").trim();
  if (!trimmed) {
    return { ok: false, status: 400, message: "文本内容不能为空" };
  }
  const { text, filtered, matches } = sanitizeChatText(trimmed);
  if (!text.trim()) {
    return { ok: false, status: 400, message: "消息内容无效" };
  }
  return { ok: true, text, sensitiveFiltered: filtered, matches };
}
