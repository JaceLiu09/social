/**
 * Expand game banks to 50 questions per category.
 * Run: node scripts/expand-game-banks.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TRUTH_CHALLENGE_BANK as TRUTH_SEED } from "../frontend/src/truthQuestionBank.js";
import { TACIT_CHALLENGE_QUESTION_BANK as TACIT_SEED } from "../backend/src/tacitQuestionBank.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SENTENCE_SEED = [
  { category: "date", stem: "周末突然下雨，我会先", options: ["约你去咖啡馆躲雨", "在家看一部老电影", "去楼下便利店买热饮"] },
  { category: "date", stem: "第一次见面最加分的是", options: ["说话真诚不端着", "穿着干净有细节", "会认真听我讲话"] },
  { category: "date", stem: "如果对方迟到十分钟，我会", options: ["先找个地方坐着等", "发消息确认是否堵车", "顺便买两杯饮料"] },
  { category: "date", stem: "最理想的约会结尾是", options: ["散步到地铁口再告别", "互发今天最喜欢的瞬间", "约好下次见面的时间"] },
  { category: "date", stem: "选餐厅时我更看重", options: ["环境安静能聊天", "菜品好吃不踩雷", "离你我都不太远"] },
  { category: "travel", stem: "一起旅行时我更在意", options: ["行程松弛不赶路", "拍照好看有仪式感", "吃到本地特色小店"] },
  { category: "travel", stem: "出门旅行前我会先", options: ["列一份轻松行程单", "查好天气和穿搭", "约好你想去的地方"] },
  { category: "travel", stem: "旅途中迷路了，我会", options: ["一起开导航慢慢找", "先买杯饮料冷静下", "干脆随缘探索新路"] },
  { category: "travel", stem: "住酒店我更偏好", options: ["交通方便出行省心", "窗景好适合发呆", "周边好吃的多"] },
  { category: "travel", stem: "旅行合照时我通常会", options: ["自然抓拍更有感觉", "找地标认真合影", "让你来选角度"] },
  { category: "emotion", stem: "关系升温最快的方式是", options: ["稳定且高质量联系", "一起完成一件小事", "情绪低落时彼此接住"] },
  { category: "emotion", stem: "当你心情不好时，我希望", options: ["先安静陪在你身边", "听你说完再给建议", "带你吃点好吃的"] },
  { category: "emotion", stem: "让我觉得被在乎的瞬间是", options: ["记得我说过的小事", "主动分享日常碎片", "难过时第一时间出现"] },
  { category: "emotion", stem: "吵架之后我更愿意", options: ["冷静后把话说清楚", "先抱抱再聊原因", "写长消息表达想法"] },
  { category: "emotion", stem: "长久相处最重要的是", options: ["彼此坦诚不隐瞒", "尊重对方的节奏", "愿意一起解决问题"] },
  { category: "ice", stem: "晚上聊天冷场时，我会", options: ["丢一个有趣的问题", "分享今天的小糗事", "发一张正在听的歌单"] },
  { category: "ice", stem: "刚认识时我最常聊", options: ["最近在看什么剧", "周末一般怎么过", "有什么奇怪的小爱好"] },
  { category: "ice", stem: "如果只能问一个问题，我会问", options: ["你最开心的童年记忆", "最近让你笑的事", "你理想的周末早晨"] },
  { category: "ice", stem: "游戏开局我会先", options: ["来个轻松热身题", "直接上难度试试", "让你先出题我接"] },
  { category: "ice", stem: "接龙答错时我通常会", options: ["自嘲一下继续玩", "要求再来一题", "吐槽你出题太刁钻"] }
];

function dedupe(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTruthCategory(difficulty, scenarios, optionSets) {
  const seeds = TRUTH_SEED.filter((q) => q.difficulty === difficulty);
  const built = [];
  for (let i = 0; i < 50; i += 1) {
    if (i < seeds.length) {
      built.push(seeds[i]);
      continue;
    }
    const scenario = scenarios[i % scenarios.length];
    const question = scenario.includes("？") ? scenario : `${scenario}，你更？`;
    const options = optionSets[i % optionSets.length];
    built.push({ difficulty, question, options: [...options] });
  }
  return dedupe(built, (q) => `${q.question}|${q.options.join("/")}`).slice(0, 50);
}

function buildTacitCategory(category, scenarios, pairs) {
  const seeds = TACIT_SEED.filter((q) => q.category === category);
  const built = [];
  for (let i = 0; i < 50; i += 1) {
    if (i < seeds.length) {
      built.push(seeds[i]);
      continue;
    }
    const scenario = scenarios[i % scenarios.length];
    const prompt = scenario.includes("？") ? scenario : `${scenario}，你更？`;
    const [optionA, optionB] = pairs[i % pairs.length];
    built.push({ category, prompt, optionA, optionB });
  }
  return dedupe(built, (q) => `${q.prompt}|${q.optionA}|${q.optionB}`).slice(0, 50);
}

function buildSentenceCategory(category, stems, optionTriples) {
  const seeds = SENTENCE_SEED.filter((q) => q.category === category);
  const built = [];
  for (let i = 0; i < 50; i += 1) {
    if (i < seeds.length) {
      built.push(seeds[i]);
      continue;
    }
    const stem = stems[i % stems.length];
    const options = optionTriples[i % optionTriples.length];
    built.push({ category, stem, options: [...options] });
  }
  return dedupe(built, (q) => `${q.stem}|${q.options.join("/")}`).slice(0, 50);
}

const TRUTH_SCENARIOS = {
  FLIRT: [
    "对方已读不回", "暧昧备注", "第一次见面后", "哪种眼神最让你慌", "语音消息", "被夸身材", "暧昧旅行", "你更受不了哪种吊着",
    "朋友圈秀恩爱尺度", "约会买单", "暧昧礼物", "对方突然靠近", "暧昧称呼", "聊天到半夜", "哪种道歉最心软", "暧昧时你更会",
    "你更吃哪种反差", "被问想我没", "暧昧电影约会", "对方分享歌单", "你更喜欢的试探", "暧昧牵手", "被说你今天好香", "你更怕哪种暧昧结局",
    "暧昧期见面频率", "哪种已读最折磨", "你更喜欢的开场白", "对方夸你性格", "暧昧自拍", "你更吃哪种保护欲", "暧昧时吃醋", "你更想被怎样记住",
    "深夜睡了吗", "暧昧拥抱时长", "你更喜欢的暧昧节奏", "对方突然说想见你", "你更受不了哪种敷衍", "暧昧时你愿分享", "对方只对你温柔", "暧昧里你更主动还是被动",
    "被说特别", "暧昧期节日", "你更喜欢的距离感", "对方突然沉默", "暧昧里谁先表白", "你更吃哪种眼神", "暧昧时会不会吃醋", "你更喜欢的聊天结尾",
    "对方发暧昧歌", "暧昧时会不会幻想见面", "你更怕哪种误会", "暧昧里谁更黏人"
  ],
  DESIRE: [
    "理想吻", "你更吃哪种声音", "占有欲爆发时", "对方穿哪类更心动", "你更想被怎样偏爱", "心动后失眠", "身体吸引和灵魂", "哪种靠近让你失控",
    "你更想听哪种承诺", "理想身高差", "你更吃哪种认真", "看到TA和别人聊", "你更想保留什么神秘", "亲密称呼", "你更怕哪种心动",
    "哪种照顾最戳你", "你更想被怎样追求", "对方认真看你时", "你更喜欢的偏心细节", "心动后你更常", "你更吃哪种成熟", "哪种拥抱你更想", "你更想被夸哪里",
    "暧昧升级恋爱", "你更受不了哪种冷淡", "理想约会结尾", "你更想被怎样坚定选择", "哪种气味更上头", "你更喜欢的黏人度", "对方脆弱时", "你更吃哪种坏笑",
    "心动证据你更信", "你更想怎样被想念", "哪种距离最暧昧", "你更怕失去什么", "对方主动牵你", "你更喜欢的惊喜频率", "哪种告白你更吃", "你更想被怎样珍惜",
    "理想型气质", "你更在意专一还是浪漫", "对方记得小事", "你更喜欢的占有欲", "心动时会不会主动", "你更吃哪种安全感", "对方为你改变计划", "你更想听哪句偏心话",
    "看到TA笑", "你更喜欢的约会频率", "对方紧张时", "你更想被怎样保护", "理想亲密称呼", "你更怕哪种敷衍喜欢"
  ],
  INTIMATE: [
    "第一次牵手后", "接吻前", "过夜聊天", "你更喜欢的亲密灯光", "亲密时说话", "你更想被怎样抱着睡", "晨间亲密", "你更在意亲密后的",
    "哪种轻触最敏感", "你更喜欢的亲密音乐", "亲密节奏被带太快", "你更想探索哪种亲密", "对方问可以吗", "你更喜欢的体温差", "亲密时眼神", "你更想在哪亲密",
    "接吻深度", "你更怕亲密时", "亲密后聊天", "你更喜欢的亲密气味", "对方帮你吹头发", "你更想被怎样解开紧张", "亲密边界", "你更喜欢的亲密时长",
    "对方事后黏你", "你更想尝试的亲密氛围", "亲密时主动方", "你更吃哪种事后温柔", "亲密中学习对方", "你更喜欢的亲密着装", "对方突然亲你", "你更想被怎样哄进状态",
    "亲密时最怕听到", "你更喜欢的亲密结尾", "哪种亲密更浪漫", "你更想被怎样珍惜身体", "亲密后第二天", "你更向往的亲密日常", "拥抱和亲吻频率", "你更喜欢的亲密温度",
    "亲密时会不会害羞", "你更想被怎样抱着", "接吻时手放哪", "你更喜欢的亲密开场", "亲密时会不会说话", "你更想在哪过夜聊天", "亲密时会不会主动", "你更喜欢的慢节奏",
    "对方尊重你节奏", "你更想被怎样安慰", "亲密时最在意氛围还是感觉", "你更喜欢的亲密惊喜"
  ],
  BOLD: [
    "你敢先开口的尺度", "对方问在想什么坏", "你更想在哪被亲", "亲密幻想", "你更吃哪种直球", "尺度玩笑", "你更想听多大胆的话", "对方突然壁咚",
    "你更敢承认的欲望", "亲密时你更想控制还是", "你更想尝试哪种刺激", "对方说别撩了", "你更想被怎样占有", "尺度升级信号", "你更怕哪种大胆",
    "亲密真心话你更敢问", "你更想在哪说想你", "对方突然留宿暗示", "你更吃哪种坏", "亲密后坦白", "你更想被怎样点名欲望", "大胆约会", "你更敢主动到哪一步",
    "对方问怕不怕", "你更想听哪种秘密", "尺度游戏", "你更想被怎样逼问真心", "亲密时突然被打断", "你更敢发哪种消息", "对方说别诱惑我", "你更想探索的边界",
    "大胆承认", "你更吃哪种危险感", "亲密请求", "你更想在哪被抱紧", "对方突然说别动", "你更敢聊哪种话题", "大胆后你更希望", "你更想听哪种欲望表达",
    "敢不敢说过夜", "你更喜欢的挑逗方式", "对方突然认真看你", "你更想尝试的角色感", "尺度对话你更", "你更怕哪种太快", "敢不敢承认幻想", "你更想被怎样点名",
    "大胆消息敢发到哪", "你更喜欢的私密夜晚", "对方突然靠近耳边", "你更想听哪种坦白", "敢不敢先伸手", "你更喜欢的坏心思"
  ]
};

const TRUTH_OPTION_SETS = {
  FLIRT: [
    ["继续发可爱表情", "也晾着TA一会", "直接问什么意思", "假装不在意其实在意"],
    ["只给你起外号", "存你照片当背景", "置顶你的聊天", "偷偷改亲密称呼"],
    ["回家回味每个细节", "立刻发消息延续", "忍住等对方先找", "跟朋友偷偷分享"],
    ["笑着看你太久", "扫过你又移开", "认真到像告白", "带着点坏笑"],
    ["爱发低沉那几句", "更爱打字留想象", "突然来电更心动", "半夜语音最上头"],
    ["害羞说别看了", "顺势开暧昧玩笑", "认真道谢并回夸", "假装生气其实开心"],
    ["同住但慢慢来", "分开住白天约会", "随性走到哪算哪", "提前规划浪漫惊喜"],
    ["忽冷忽热", "只撩不负责", "暧昧却不确认", "对你和别人双标"],
    ["发合照但不官宣", "只发暗示文案", "私下给你专属分享", "完全低调保护你"],
    ["抢着表现诚意", "自然轮流更舒服", "喜欢被照顾一次", "不在意谁付"],
    ["手写情话卡片", "记得你爱的小物", "突然送花不解释", "实用里藏小心思"],
    ["心跳漏一拍", "故作镇定反撩", "微微后退留张力", "直接迎上去"]
  ],
  DESIRE: [
    ["先轻再深", "突然但很温柔", "边聊边靠近", "分别时忍不住"],
    ["低沉耳边语", "笑起来的气音", "认真说话很稳", "撒娇尾音"],
    ["想公开关系", "想独占一晚", "想确认你也上头", "想立刻见面"],
    ["干净白衬衫", "休闲家居感", "约会精心打扮", "运动完微汗"],
    ["只对你坏笑", "只对你温柔", "只对你撒娇", "只对你坦白"],
    ["翻聊天记录", "想象下次见面", "发消息试探", "听歌想到TA"],
    ["灵魂共鸣优先", "两者都要", "先心动再谈身体", "化学反应很重要"],
    ["脖颈轻触", "腰被搂住", "额头相抵", "背后被抱住"],
    ["只想和你在一起", "认真交往不玩玩", "会慢慢对你更好", "现在就很在意你"],
    ["喜欢被环抱", "平视最舒服", "不在意这些", "喜欢仰头看对方"],
    ["记得你说的话", "为你改计划", "吵架仍站你这边", "把你介绍给朋友"],
    ["有点吃醋正常", "希望TA主动解释", "相信自己很特别", "直接表达介意"]
  ],
  INTIMATE: [
    ["立刻拥抱", "慢慢聊天", "继续散步装淡定", "想亲但忍住"],
    ["喜欢对方主动", "自己来更自然", "互相试探靠近", "看气氛谁都可以"],
    ["聊过去和未来", "聊喜欢怎样的亲密", "聊日常碎碎念", "聊到后来安静抱"],
    ["暖黄暧昧", "只留小夜灯", "自然光也OK", "黑暗靠触感"],
    ["轻声夸对方", "少说专注感受", "偶尔逗一下", "认真问舒不舒服"],
    ["整个人窝怀里", "背后被环住", "面对面腿缠住", "各睡各的但牵手"],
    ["醒来先抱一会", "亲吻说早安", "一起赖床", "做早餐也甜蜜"],
    ["继续温存", "聊天确认感受", "一起洗澡", "安静躺一会"],
    ["耳后", "后颈", "腰侧", "手心"],
    ["慢节奏R&B", "没有音乐更专注", "轻爵士", "对方歌单"],
    ["直接说慢一点", "用动作示意", "勉强配合", "事后才表达"],
    ["长时间亲吻", "拥抱不分开", "一起泡澡聊天", "循序渐进更深"]
  ],
  BOLD: [
    ["想抱抱", "想接吻", "想过夜聊天", "想更进一步"],
    ["直接说想你", "故意卖关子", "凑近耳语", "说你想听的那种"],
    ["唇", "脖颈", "额头", "手心"],
    ["雨夜沙发", "旅行酒店", "清晨被窝", "电影院角落"],
    ["我现在很想你", "我想抱你", "我想亲你", "我想和你更近"],
    ["偶尔开一点", "只私下开", "不喜欢", "互相接梗更好"],
    ["有点撩就够", "越直白越上头", "看气氛", "行动大于语言"],
    ["心跳爆炸", "反撩回去", "假装嫌弃", "直接亲上去"],
    ["想被抱紧", "想被亲久一点", "想过夜", "想确认专属关系"],
    ["交给对方", "自己主导", "轮流", "默契就好"],
    ["半公开场合牵手", "私密角色扮演", "旅行陌生环境", "都不想要"],
    ["偏要继续一点", "立刻收手", "问那其实想要吗", "换温柔方式"]
  ]
};

const TACIT_SCENARIOS = {
  social: [
    "暧昧回复速度", "对方突然撒娇", "线上暧昧升温", "第一次见面后", "被夸好看", "暧昧期节日", "朋友圈互动", "深夜消息",
    "聊天冷场", "对方若即若离", "暧昧称呼", "被说只对你这样", "约会结束", "暧昧礼物", "哪种撩法", "心动信号",
    "暧昧时吃醋", "更喜欢哪种靠近", "被撩脸红", "暧昧自拍", "语音还是文字", "暧昧旅行", "对方认真看你", "暧昧节奏",
    "已读不回", "暧昧备注", "保护欲细节", "暧昧电影", "分享歌单", "试探方式", "牵手时机", "被说你好香",
    "暧昧结局", "见面频率", "开场白", "夸性格", "小动作加分", "聊天结尾", "暧昧里谁主动", "发暧昧歌",
    "幻想见面", "怕哪种误会", "黏人程度", "暧昧玩笑尺度", "对方突然沉默", "暧昧里表白", "眼神交流", "专属感",
    "暧昧时分享", "只对你温柔", "暧昧距离", "被说特别"
  ],
  life: [
    "独处夜晚", "居家穿搭", "睡前习惯", "洗澡后", "周末独处", "家里氛围", "情绪低落", "深夜饿了",
    "生活记录", "起床第一眼", "雨天在家", "衣柜风格", "独处时会想", "夜晚状态", "生活仪式感", "家里留宿",
    "私密习惯", "吹头发", "周末早晨", "一个人看剧", "卧室灯光", "生活碎片", "失眠时", "居家约会",
    "私密空间", "香薰味道", "冰箱囤货", "睡前护肤", "居家自拍", "独处听歌", "周末打扫", "夜间零食",
    "居家办公", "睡衣风格", "阳台发呆", "睡前刷手机", "独居安全感", "居家运动", "夜间开窗", "居家香氛",
    "独处写日记", "周末补觉", "居家咖啡", "夜间想人", "居家收纳", "睡前热水澡", "独处冥想", "居家宠物",
    "夜间读书", "居家火锅", "独处购物", "睡前想TA"
  ],
  love: [
    "心动瞬间", "第一次想亲", "拥抱方式", "接吻氛围", "受不了的靠近", "亲密时在意", "过夜期待", "关系升温",
    "想亲的瞬间", "坚定选择", "亲密后希望", "亲密节奏", "情话类型", "身体接触", "亲密夜晚", "占有欲",
    "更进一步前", "欲望表达", "亲密保留度", "困时靠过来", "亲密体验", "确认关系", "腿软接触", "亲密最怕",
    "坦白类型", "亲吻深度", "亲密主动", "事后温柔", "亲密边界", "亲密时长", "晨间亲密", "亲密音乐",
    "亲密灯光", "拥抱睡觉", "亲密后聊天", "敏感部位", "亲密气味", "吹头发", "解开紧张", "亲密着装",
    "突然亲你", "哄进状态", "亲密结尾", "浪漫夜晚", "珍惜身体", "亲密第二天", "亲密日常", "接吻手放哪",
    "害羞程度", "慢热亲密", "尊重节奏", "亲密安慰"
  ],
  fun: [
    "约会娱乐", "一起看电影", "深夜消遣", "KTV风格", "旅行住宿", "周末娱乐", "暧昧片单", "游戏互动",
    "节日安排", "雨天约会", "夜生活", "一起拍照", "看展逛馆", "宵夜选择", "长途车上", "游乐园",
    "暧昧BGM", "聚会后续", "旅行合照", "看球演出", "密室逃脱", "海边夜晚", "一起下厨", "暧昧游戏",
    "深夜兜风", "酒吧小酌", "咖啡约会", "夜市逛街", "桌游夜", "露营星空", "滑雪度假", "温泉旅行",
    "演唱会", "剧本杀", "电玩城", "野餐", "骑行", "摄影扫街", "livehouse", "脱口秀",
    "逛书店", "逛花市", "做手工", "烘焙", "跳舞", "游泳", "爬山", "钓鱼",
    "逛博物馆", "坐摩天轮", "看烟花", "放河灯", "逛古镇", "吃自助餐"
  ]
};

const TACIT_PAIRS = {
  social: [
    ["秒回暧昧", "故意慢回"], ["主动出击", "等对方先"], ["发语音撩", "打字留想象"], ["见面确认", "继续线上"],
    ["立刻害羞", "顺势反撩"], ["准备惊喜", "简单陪伴"], ["公开互动", "私下更暧昧"], ["深夜直球", "含蓄暗示"],
    ["抛暧昧问题", "分享糗事"], ["更想抓住", "也晾一下"], ["亲昵外号", "温柔全名"], ["瞬间上头", "先观察"],
    ["再多待会", "回家继续聊"], ["手写纸条", "记得口味"], ["眼神撩", "耳边低语"], ["记得小事", "只对你温柔"]
  ],
  life: [
    ["刷剧很晚", "听歌想人"], ["慵懒睡衣", "精致居家"], ["聊天才睡", "留点空间"], ["分享自拍", "窝被不想动"],
    ["补觉自然醒", "出门散心"], ["香薰暧昧", "简单干净"], ["想被抱着", "先独处"], ["云吃外卖", "翻冰箱"],
    ["拍氛围照", "写日记"], ["看TA消息", "安静醒神"], ["窝沙发", "听雨发呆"], ["家居服多", "战袍多"],
    ["想怎么穿", "怕太黏人"], ["说真心话", "胡思乱想"], ["互道晚安", "见面打扮"], ["怕不自在", "怕太随便"],
    ["有人陪", "要独处"], ["想帮吹", "自己来"], ["赖床抱抱", "早起早餐"], ["分享梗", "安静沉浸"]
  ],
  love: [
    ["眼神太久", "肢体碰触"], ["气氛上头", "分别舍不得"], ["抱紧不松", "轻轻靠着"], ["安静呼吸", "轻音乐暗光"],
    ["脖颈轻吻", "整个人抱紧"], ["尊重节奏", "彼此投入"], ["聊天天亮", "拥抱入睡"], ["确认心意", "顺其自然"],
    ["洗完澡", "笑着看你"], ["说只喜欢", "放进计划"], ["继续抱着", "轻声喜欢"], ["慢有张力", "直接表达"],
    ["我很想你", "只想一起"], ["循序渐进", "气氛到了"], ["电影亲热", "只拥抱"], ["吃醋可爱", "空间专一"],
    ["聊清边界", "看感觉"], ["眼神很热", "半开玩笑"], ["止于亲吻", "看安全感"], ["立刻搂住", "轻轻摸头"]
  ],
  fun: [
    ["私密影院", "夜市边走边吃"], ["爱情暧昧片", "搞笑轻松片"], ["连麦游戏", "点夜宵"], ["对唱情歌", "搞怪嗨"],
    ["氛围民宿", "方便酒店"], ["探店拍照", "宅家看剧"], ["日系慢热", "张力欧美"], ["默契游戏", "竞技小游戏"],
    ["两人过节", "朋友热闹"], ["咖啡馆", "火锅电影"], ["小酒吧", "散步回家"], ["自然抓拍", "精致摆拍"],
    ["牵手慢看", "各看各分享"], ["路边摊", "日料小馆"], ["靠肩睡", "听歌看景"], ["摩天轮", "刺激尖叫"],
    ["慢R&B", "复古情歌"], ["单独续摊", "回家聊天"], ["亲密合照", "风景人像"], ["牵手欢呼", "安静专注"]
  ]
};

const SENTENCE_STEMS = {
  date: [
    "第一次约会选地方我会", "约会前我会", "吃饭时我更会", "饭后散步我更喜欢", "约会结束送别我会",
    "对方紧张时我会", "选电影我会", "约会迟到我会", "下雨天约会我会", "对方夸我好看我会",
    "第一次牵手我会", "约会买单我会", "对方分享烦恼我会", "约会穿搭我更在意", "见面第一眼我会",
    "下午茶约会我更喜欢", "对方突然靠近我会", "约会拍照我会", "对方迟到我会", "夜景约会我更喜欢",
    "第一次见朋友我会", "对方害羞我会", "约会惊喜我更", "饭后甜品我会", "被问喜欢什么类型我会",
    "约会冷场我会", "对方买单我会", "第一次拥抱我会", "约会消息我会", "对方说累了我会",
    "选座位我会", "约会香水我会", "对方开玩笑我会", "约会结束回家我会", "周末约会我更喜欢",
    "对方分享日常我会", "约会中下雨我会", "第一次亲亲我会", "对方看手机我会", "约会穿搭颜色我会",
    "对方说饿了我会", "约会中拍照我会", "对方提到前任我会", "约会结束会不会", "暧昧约会我更喜欢",
    "对方突然表白我会", "约会中沉默我会", "第一次约会礼物我会", "对方夸我性格我会", "约会交通我会"
  ],
  travel: [
    "旅行出发前我会", "选目的地我会", "订酒店我更看重", "旅行穿搭我会", "机场见面我会",
    "旅途中迷路我会", "旅行拍照我会", "吃当地美食我会", "旅行节奏我更喜欢", "住民宿我会",
    "旅行预算我会", "早起看日出我会", "旅行吵架我会", "购物纪念品我会", "旅行夜聊我会",
    "坐高铁我会", "旅行惊喜我更", "海边旅行我会", "爬山旅行我会", "古城旅行我会",
    "旅行合照我会", "下雨改计划我会", "旅行分工我会", "深夜到达我会", "旅行vlog我会",
    "自驾旅行我会", "旅行_sleep我会", "排队景点我会", "旅行生病我会", "看地图我会",
    "旅行零食我会", "异国旅行我会", "露营旅行我会", "旅行告别我会", "回程路上我会",
    "旅行记账我会", "偶遇美景我会", "旅行穿搭拍照我会", "当地交通我会", "旅行中的小争执我会",
    "住青旅我会", "旅行购物我会", "看日落我会", "旅行中想家我会", "温泉旅行我会",
    "旅行计划变更我会", "夜市旅行我会", "旅行中表白我会", "雪地旅行我会", "旅行结束我会"
  ],
  emotion: [
    "关系升温我会", "你难过时我会", "被在乎瞬间我会", "吵架后我会", "长久相处我会",
    "暧昧升级我会", "你压力大我会", "想确认关系我会", "被误会我会", "节日仪式感我会",
    "异地恋我会", "见家长前我会", "低落情绪里我会", "想放弃时我会", "被夸赞后我会",
    "冷战阶段我会", "认真交往后我会", "想复合我会", "被坚定选择我会", "分享脆弱我会",
    "信任建立我会", "边界被踩我会", "想更进一步我会", "安全感不足我会", "表达爱意我会",
    "吵架时语气我会", "和好方式我会", "长期计划我会", "情绪爆发我会", "需要空间我会",
    "被忽视我会", "想被理解我会", "关系确认我会", "暧昧结束我会", "心动证据我会",
    "依赖感来了我会", "说分手我会", "被道歉我会", "主动沟通我会", "沉默冷战我会",
    "被比较我会", "想结婚我会", "价值观冲突我会", "被放鸽子我会", "感情变淡我会",
    "被惊喜我会", "需要承诺我会", "被欺骗我会", "重新心动我会", "说真心话我会"
  ],
  ice: [
    "冷场时我会", "刚认识聊天我会", "只问一题我会", "游戏开局我会", "答错时我会",
    "破冰第一句我会", "尴尬沉默我会", "刚加好友我会", "线上初聊我会", "见面破冰我会",
    "社恐发作我会", "抛话题我会", "自嘲我会", "夸对方我会", "分享趣事我会",
    "问兴趣爱好我会", "聊工作我会", "聊家乡我会", "聊美食我会", "聊宠物我会",
    "聊电影我会", "聊音乐我会", "聊旅行我会", "聊运动我会", "聊游戏我会",
    "表情包破冰我会", "语音破冰我会", "视频破冰我会", "群聊破冰我会", "二次见面我会",
    "被介绍认识我会", "相亲破冰我会", "同事变朋友我会", "邻居搭讪我会", "活动认识我会",
    "对方高冷我会", "对方话多我会", "对方害羞我会", "对方幽默我会", "对方严肃我会",
    "聊天气我会", "聊周末我会", "聊最近忙我会", "聊梦想我会", "聊糗事我会",
    "真心话破冰我会", "小游戏破冰我会", "共同好友我会", "借东西搭讪我会", "结束聊天我会"
  ]
};

const SENTENCE_OPTIONS = {
  date: [
    ["挑安静能聊天的", "选TA可能喜欢的", "就近轻松不隆重", "故意留点神秘感"],
    ["提前想好穿搭", "查路线别迟到", "准备一个小话题", "假装随意其实很重视"],
    ["认真听TA说话", "分享有趣小事", "适时夸TA细节", "用幽默化解尴尬"],
    ["慢慢走聊心事", "找夜景拍照", "牵手自然发生", "各走各的偶尔碰手"],
    ["多看两眼再走", "发消息说今天开心", "约好下次时间", "忍住不说舍不得"],
    ["先开玩笑放松", "认真说不用紧张", "分享糗事", "安静陪着"],
    ["让TA先选", "选轻松不尴尬", "选浪漫一点的", "选都感兴趣的"],
    ["提前发消息说明", "带点歉意小礼物", "见面先道歉", "装作没事其实愧疚"],
    ["改室内计划", "买伞一起躲雨", "觉得反而浪漫", "有点烦躁但不说"],
    ["害羞说谢谢", "回夸TA更好看", "开玩笑带过", "认真道谢并开心"],
    ["等气氛自然", "过马路时主动", "等对方先伸手", "假装不经意碰到"],
    ["主动抢着付", "提议AA更轻松", "看对方态度", "这次我下次你"],
    ["先听再给建议", "请喝东西安慰", "转移话题逗开心", "认真帮分析"],
    ["干净舒服", "有一点小心机", "跟场合匹配", "像我自己就好"],
    ["微笑先打招呼", "夸对方今天状态", "假装淡定其实心动", "找话题破冰"]
  ],
  travel: [
    ["列轻松行程", "查天气穿搭", "约好想去哪", "随性走到哪算哪"],
    ["一起商量", "我来定大方向", "让TA定我来配合", "看心情临时改"],
    ["交通方便", "窗景氛围", "周边好吃", "安静好睡"],
    ["舒适为主", "拍照好看", "跟目的地搭", "怎么方便怎么来"],
    ["提前到达等", "踩点到刚刚好", "带点小惊喜", "假装淡定其实激动"],
    ["一起开导航", "先买饮料冷静", "随缘探索新路", "问路交朋友"],
    ["自然抓拍", "地标认真合影", "让TA选角度", "不太爱拍"],
    ["必吃榜打卡", "路边小店随缘", "自己做攻略", "听当地人推荐"],
    ["松弛不赶路", "充实满满", "一半一半", "看当时心情"],
    ["氛围感优先", "性价比优先", "位置优先", "听TA的"],
    ["提前算好", "大概心里有数", "边走边花", "不太在意"],
    ["一定去", "看天气再说", "睡到自然醒", "叫TA一起看"],
    ["冷静沟通", "先暂停各自走", "买点好吃的缓和", "当场说开"],
    ["买有意义的", "买好吃的", "拍照留念就够", "不太买"],
    ["聊今天见闻", "聊明天计划", "安静看夜景", "早点休息"]
  ],
  emotion: [
    ["多联系高质量", "一起完成小事", "低落时接住", "见面缩短距离"],
    ["安静陪着", "听完后给建议", "带好吃的", "给空间稍后再聊"],
    ["记得小事", "主动分享日常", "难过时出现", "用行动证明"],
    ["冷静后说清楚", "先抱抱再聊", "写长消息", "给彼此台阶"],
    ["坦诚不隐瞒", "尊重节奏", "一起解决问题", "保留个人空间"],
    ["直接一点", "再观察看看", "用玩笑试探", "等对方先迈步"],
    ["帮一起想办法", "安静陪着", "给独处空间", "带出去散心"],
    ["认真告白", "行动证明", "先聊感受", "等更成熟时机"],
    ["先听我说", "主动道歉", "给我台阶", "用行动修复"],
    ["精心准备", "简单陪伴", "一起完成小事", "不太在意形式"],
    ["固定视频时间", "小惊喜", "分享琐碎", "明确见面计划"],
    ["怕表现不好", "怕家人不喜欢", "怕话题尴尬", "其实不太紧张"],
    ["最怕被否定", "最怕冷暴力", "最怕翻旧账", "最怕不被理解"],
    ["回忆初心", "看对方改变", "愿意沟通", "舍不得回忆"],
    ["开心接受", "害羞否认", "认真道谢", "回夸对方"]
  ],
  ice: [
    ["丢有趣问题", "分享小糗事", "发正在听的歌", "表情包救场"],
    ["聊最近在追的剧", "聊周末怎么过", "聊奇怪小爱好", "聊最近吃到好吃的"],
    ["问最开心童年", "问最近笑的事", "问理想周末早晨", "问最想去的地方"],
    ["轻松热身", "直接上难度", "让对方先出", "随机应变"],
    ["自嘲一下继续", "要求再来一题", "吐槽出题刁钻", "笑着认栽"],
    ["问今天怎么样", "夸对方头像", "分享刚看到的事", "发搞笑视频"],
    ["假装接水路过", "借话题切入", "等对方先开口", "直接说想认识"],
    ["文字先聊熟", "语音更真实", "约见面聊", "看对方节奏"],
    ["带个小礼物", "准时到达", "提前想好话题", "自然出现不打招呼"],
    ["躲一会儿再来", "硬着头皮上", "拉朋友一起", "自嘲化解"],
    ["抛开放问题", "聊当下环境", "夸细节", "分享同类经历"],
    ["先夸外表", "先夸气质", "先夸声音", "先夸穿搭"],
    ["讲自己糗事", "讲朋友糗事", "讲段子", "讲冷知识"],
    ["问爱好", "问工作", "问家乡", "问美食"],
    ["聊热门剧", "聊冷门片", "聊综艺", "聊纪录片"]
  ]
};

function formatTruthFile(bank) {
  const lines = bank.map(
    (q) =>
      `  {\n    difficulty: "${q.difficulty}",\n    question: "${q.question}",\n    options: ${JSON.stringify(q.options)}\n  }`
  );
  return `export const TRUTH_STYLE_OPTIONS = [
  { id: "FLIRT", label: "暧昧试探", desc: "撩人分寸、心动信号", emoji: "😏" },
  { id: "DESIRE", label: "心动偏爱", desc: "喜欢类型、占有欲", emoji: "💓" },
  { id: "INTIMATE", label: "亲密升温", desc: "靠近拥抱、接吻想象", emoji: "🔥" },
  { id: "BOLD", label: "大胆真心", desc: "尺度升级、直面欲望", emoji: "🌶️" },
  { id: "MIXED", label: "随机混合", desc: "每题随机风格", emoji: "🎲" }
];

export const TRUTH_STYLE_POOL = ["FLIRT", "DESIRE", "INTIMATE", "BOLD"];

export function getTruthStyleLabel(styleId) {
  return TRUTH_STYLE_OPTIONS.find((item) => item.id === styleId)?.label || "暧昧试探";
}

export function getTruthStyleMeta(styleId) {
  return TRUTH_STYLE_OPTIONS.find((item) => item.id === styleId) || TRUTH_STYLE_OPTIONS[0];
}

export const TRUTH_CHALLENGE_BANK = [
${lines.join(",\n")}
];
`;
}

function formatTacitFile(bank) {
  const byCat = { social: [], life: [], love: [], fun: [] };
  bank.forEach((q) => byCat[q.category].push(q));
  const block = (name, items) =>
    `const ${name} = [\n${items.map((q) => `  { prompt: ${JSON.stringify(q.prompt)}, optionA: ${JSON.stringify(q.optionA)}, optionB: ${JSON.stringify(q.optionB)} }`).join(",\n")}\n];`;
  return `${block("SOCIAL_QUESTIONS", byCat.social)}

${block("LIFE_QUESTIONS", byCat.life)}

${block("LOVE_QUESTIONS", byCat.love)}

${block("FUN_QUESTIONS", byCat.fun)}

function withCategory(items, category) {
  return items.map((item) => ({ ...item, category }));
}

export const TACIT_TOPIC_META = [
  { id: "social", label: "暧昧社交" },
  { id: "life", label: "私密生活" },
  { id: "love", label: "亲密心动" },
  { id: "fun", label: "氛围娱乐" },
  { id: "mixed", label: "随机混合" }
];

export const TACIT_TOPIC_POOL = ["social", "life", "love", "fun"];

export const TACIT_CHALLENGE_QUESTION_BANK = [
  ...withCategory(SOCIAL_QUESTIONS, "social"),
  ...withCategory(LIFE_QUESTIONS, "life"),
  ...withCategory(LOVE_QUESTIONS, "love"),
  ...withCategory(FUN_QUESTIONS, "fun")
];

function shuffle(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function normalizeTacitTopic(raw) {
  const id = String(raw || "social").trim().toLowerCase();
  if (id === "mixed") return "mixed";
  return TACIT_TOPIC_POOL.includes(id) ? id : "social";
}

export function getTacitTopicLabel(topicId) {
  const id = normalizeTacitTopic(topicId);
  if (id === "mixed") return "随机混合";
  return TACIT_TOPIC_META.find((item) => item.id === id)?.label || "暧昧社交";
}

export function sampleTacitQuestionsForRound({ topicCategory = "social", count = 10 } = {}) {
  const topic = normalizeTacitTopic(topicCategory);
  let pool = TACIT_CHALLENGE_QUESTION_BANK;
  if (topic !== "mixed") {
    const filtered = TACIT_CHALLENGE_QUESTION_BANK.filter((item) => item.category === topic);
    pool = filtered.length >= count ? filtered : TACIT_CHALLENGE_QUESTION_BANK;
  }
  return shuffle(pool).slice(0, count);
}
`;
}

function formatSentenceFile(bank) {
  const lines = bank.map(
    (q) =>
      `  {\n    category: "${q.category}",\n    stem: ${JSON.stringify(q.stem)},\n    options: ${JSON.stringify(q.options)}\n  }`
  );
  return `export const SENTENCE_TOPIC_META = [
  { id: "date", label: "约会日常", desc: "见面相处、心动瞬间", emoji: "💕" },
  { id: "travel", label: "旅行出游", desc: "路线美食、同行默契", emoji: "✈️" },
  { id: "emotion", label: "情感心声", desc: "信任陪伴、关系升温", emoji: "💬" },
  { id: "ice", label: "轻松破冰", desc: "冷场救星、搞怪接龙", emoji: "😄" }
];

export const SENTENCE_CHAIN_BANK = [
${lines.join(",\n")}
];
`;
}

const truthBank = [
  ...buildTruthCategory("FLIRT", TRUTH_SCENARIOS.FLIRT, TRUTH_OPTION_SETS.FLIRT),
  ...buildTruthCategory("DESIRE", TRUTH_SCENARIOS.DESIRE, TRUTH_OPTION_SETS.DESIRE),
  ...buildTruthCategory("INTIMATE", TRUTH_SCENARIOS.INTIMATE, TRUTH_OPTION_SETS.INTIMATE),
  ...buildTruthCategory("BOLD", TRUTH_SCENARIOS.BOLD, TRUTH_OPTION_SETS.BOLD)
];

const tacitBank = [
  ...buildTacitCategory("social", TACIT_SCENARIOS.social, TACIT_PAIRS.social),
  ...buildTacitCategory("life", TACIT_SCENARIOS.life, TACIT_PAIRS.life),
  ...buildTacitCategory("love", TACIT_SCENARIOS.love, TACIT_PAIRS.love),
  ...buildTacitCategory("fun", TACIT_SCENARIOS.fun, TACIT_PAIRS.fun)
];

const sentenceBank = [
  ...buildSentenceCategory("date", SENTENCE_STEMS.date, SENTENCE_OPTIONS.date),
  ...buildSentenceCategory("travel", SENTENCE_STEMS.travel, SENTENCE_OPTIONS.travel),
  ...buildSentenceCategory("emotion", SENTENCE_STEMS.emotion, SENTENCE_OPTIONS.emotion),
  ...buildSentenceCategory("ice", SENTENCE_STEMS.ice, SENTENCE_OPTIONS.ice)
];

function countBy(bank, key) {
  return bank.reduce((m, i) => {
    m[i[key]] = (m[i[key]] || 0) + 1;
    return m;
  }, {});
}

for (const [name, bank, key] of [
  ["truth", truthBank, "difficulty"],
  ["tacit", tacitBank, "category"],
  ["sentence", sentenceBank, "category"]
]) {
  const counts = countBy(bank, key);
  for (const [cat, n] of Object.entries(counts)) {
    if (n !== 50) throw new Error(`${name} ${cat}: expected 50, got ${n}`);
  }
}

fs.writeFileSync(path.join(root, "frontend/src/truthQuestionBank.js"), formatTruthFile(truthBank));
fs.writeFileSync(path.join(root, "backend/src/tacitQuestionBank.js"), formatTacitFile(tacitBank));
fs.writeFileSync(path.join(root, "frontend/src/sentenceQuestionBank.js"), formatSentenceFile(sentenceBank));

// Trim common ground love category to exactly 50
const cgPath = path.join(root, "frontend/src/commonGroundQuestionBank.js");
const cgRaw = fs.readFileSync(cgPath, "utf8");
const cgModule = await import(`file://${cgPath}`);
const cgBank = cgModule.COMMON_GROUND_BANK;
const loveItems = cgBank.filter((i) => i.category === "love");
if (loveItems.length > 50) {
  const removeIds = new Set(loveItems.slice(50).map((i) => i.id));
  const trimmed = cgBank.filter((i) => !removeIds.has(i.id));
  const updated = cgRaw.replace(
    /export const COMMON_GROUND_BANK = \[[\s\S]*\];/,
    `export const COMMON_GROUND_BANK = ${JSON.stringify(trimmed, null, 2)};`
  );
  fs.writeFileSync(cgPath, updated);
  console.log("commonGround: trimmed love to 50");
}

console.log("truth", countBy(truthBank, "difficulty"));
console.log("tacit", countBy(tacitBank, "category"));
console.log("sentence", countBy(sentenceBank, "category"));
console.log("Done.");
