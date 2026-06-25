const SOCIAL_QUESTIONS = [
  { prompt: "暧昧聊天时你更常？", optionA: "主动出击撩", optionB: "慢热等对方" },
  { prompt: "被撩到心动你更？", optionA: "反撩回去", optionB: "装淡定其实心动" },
  { prompt: "深夜消息你更吃？", optionA: "突然说想你", optionB: "发仅你可见" },
  { prompt: "线上暧昧升温你更想？", optionA: "连麦聊到半夜", optionB: "约见面确认感觉" },
  { prompt: "对方若即若离你更？", optionA: "更想抓住TA", optionB: "也故意慢回" },
  { prompt: "第一次见面氛围你更选？", optionA: "灯光暗一点", optionB: "自然明亮轻松" },
  { prompt: "心动信号你更信？", optionA: "只对你温柔", optionB: "记得你说的小事" },
  { prompt: "暧昧期你最想确认？", optionA: "TA是不是也心动", optionB: "我们算不算特别" },
  { prompt: "聊天冷场你更会？", optionA: "开个暧昧玩笑", optionB: "分享私密歌单" },
  { prompt: "被认真夸好看你更？", optionA: "立刻害羞", optionB: "顺势撩回去" },
  { prompt: "更喜欢哪种靠近？", optionA: "并肩手臂轻碰", optionB: "过马路自然牵手" },
  { prompt: "对方突然撒娇你更？", optionA: "心软立刻回应", optionB: "嘴上逗TA其实宠" },
  { prompt: "朋友圈互动你更在意？", optionA: "会认真评论", optionB: "私下聊得更暧昧" },
  { prompt: "哪种撩法最受不了？", optionA: "认真盯着眼睛", optionB: "耳边低声说话" },
  { prompt: "暧昧升温最快靠？", optionA: "分享脆弱一面", optionB: "肢体距离缩短" },
  { prompt: "约会结束你更想？", optionA: "再多待一会儿", optionB: "回家继续聊天" },
  { prompt: "被说“只对你这样”你更？", optionA: "瞬间上头", optionB: "先观察是不是套路" },
  { prompt: "更喜欢哪种称呼？", optionA: "亲昵外号", optionB: "全名但很温柔" },
  { prompt: "线上聊到哪种程度会想见面？", optionA: "说过想抱抱", optionB: "互发过素颜照" },
  { prompt: "暧昧时你更怕？", optionA: "对方不够认真", optionB: "自己先陷太深" },
  { prompt: "哪种小动作最加分？", optionA: "帮你挡风拉外套", optionB: "递东西时指尖碰触" },
  { prompt: "被撩到脸红你更？", optionA: "假装生气", optionB: "直接承认心动" },
  { prompt: "更喜欢哪种聊天节奏？", optionA: "每天固定暧昧聊", optionB: "突然热烈一阵" },
  { prompt: "对方吃醋你更？", optionA: "觉得有点可爱", optionB: "希望TA直接说" },
  { prompt: "暧昧礼物你更吃？", optionA: "手写小纸条", optionB: "记得你爱喝的奶茶" },
  { prompt: "暧昧备注，你更？", optionA: "更想抓住", optionB: "也晾一下" },
  { prompt: "保护欲细节，你更？", optionA: "亲昵外号", optionB: "温柔全名" },
  { prompt: "暧昧电影，你更？", optionA: "瞬间上头", optionB: "先观察" },
  { prompt: "分享歌单，你更？", optionA: "再多待会", optionB: "回家继续聊" },
  { prompt: "试探方式，你更？", optionA: "手写纸条", optionB: "记得口味" },
  { prompt: "牵手时机，你更？", optionA: "眼神撩", optionB: "耳边低语" },
  { prompt: "被说你好香，你更？", optionA: "记得小事", optionB: "只对你温柔" },
  { prompt: "暧昧结局，你更？", optionA: "秒回暧昧", optionB: "故意慢回" },
  { prompt: "见面频率，你更？", optionA: "主动出击", optionB: "等对方先" },
  { prompt: "开场白，你更？", optionA: "发语音撩", optionB: "打字留想象" },
  { prompt: "夸性格，你更？", optionA: "见面确认", optionB: "继续线上" },
  { prompt: "小动作加分，你更？", optionA: "立刻害羞", optionB: "顺势反撩" },
  { prompt: "聊天结尾，你更？", optionA: "准备惊喜", optionB: "简单陪伴" },
  { prompt: "暧昧里谁主动，你更？", optionA: "公开互动", optionB: "私下更暧昧" },
  { prompt: "发暧昧歌，你更？", optionA: "深夜直球", optionB: "含蓄暗示" },
  { prompt: "幻想见面，你更？", optionA: "抛暧昧问题", optionB: "分享糗事" },
  { prompt: "怕哪种误会，你更？", optionA: "更想抓住", optionB: "也晾一下" },
  { prompt: "黏人程度，你更？", optionA: "亲昵外号", optionB: "温柔全名" },
  { prompt: "暧昧玩笑尺度，你更？", optionA: "瞬间上头", optionB: "先观察" },
  { prompt: "对方突然沉默，你更？", optionA: "再多待会", optionB: "回家继续聊" },
  { prompt: "暧昧里表白，你更？", optionA: "手写纸条", optionB: "记得口味" },
  { prompt: "眼神交流，你更？", optionA: "眼神撩", optionB: "耳边低语" },
  { prompt: "专属感，你更？", optionA: "记得小事", optionB: "只对你温柔" },
  { prompt: "暧昧时分享，你更？", optionA: "秒回暧昧", optionB: "故意慢回" },
  { prompt: "只对你温柔，你更？", optionA: "主动出击", optionB: "等对方先" }
];

const LIFE_QUESTIONS = [
  { prompt: "独处夜晚你更常？", optionA: "刷剧到很晚", optionB: "听歌发呆想人" },
  { prompt: "居家状态你更？", optionA: "宽松睡衣慵懒", optionB: "收拾干净有仪式感" },
  { prompt: "睡前习惯你更？", optionA: "一定要聊天才睡", optionB: "留点自己的空间" },
  { prompt: "洗澡后你更？", optionA: "立刻分享自拍", optionB: "窝在被窝里不想动" },
  { prompt: "周末一个人你更想？", optionA: "补觉到自然醒", optionB: "出门散心换心情" },
  { prompt: "家里氛围你更偏爱？", optionA: "香薰灯光暧昧", optionB: "简单干净就好" },
  { prompt: "情绪低落时你更？", optionA: "想有人抱着", optionB: "先独处再联系" },
  { prompt: "深夜饿了你会？", optionA: "点外卖一起云吃", optionB: "翻冰箱随便对付" },
  { prompt: "生活记录你更？", optionA: "拍氛围感照片", optionB: "写日记留给自己" },
  { prompt: "起床第一眼你更想？", optionA: "看到TA的消息", optionB: "自己安静醒神" },
  { prompt: "雨天在家你更？", optionA: "窝沙发看电影", optionB: "听雨发呆想心事" },
  { prompt: "衣柜里你更常见？", optionA: "舒服家居服", optionB: "约会战袍不少" },
  { prompt: "独处时会想？", optionA: "下次见面怎么穿", optionB: "最近是不是太黏人" },
  { prompt: "夜晚更容易？", optionA: "说真心话", optionB: "胡思乱想睡不着" },
  { prompt: "生活仪式感你更？", optionA: "睡前互道晚安", optionB: "见面时认真打扮" },
  { prompt: "家里留宿你更在意？", optionA: "对方会不会自在", optionB: "会不会太随便" },
  { prompt: "私密小习惯你更？", optionA: "喜欢有人陪着", optionB: "保留独处时间" },
  { prompt: "洗完澡头发湿着时更？", optionA: "想有人帮吹", optionB: "自己搞定就好" },
  { prompt: "周末早晨你更？", optionA: "赖床抱抱", optionB: "早起做早餐" },
  { prompt: "一个人看剧你更？", optionA: "开弹幕分享梗", optionB: "安静沉浸" },
  { prompt: "卧室灯光你更？", optionA: "暖黄暧昧一点", optionB: "亮一点有安全感" },
  { prompt: "生活碎片你更愿意？", optionA: "发给在意的人", optionB: "只留在相册里" },
  { prompt: "失眠时你更想？", optionA: "连麦说说话", optionB: "听白噪音自己睡" },
  { prompt: "居家约会你更？", optionA: "一起下厨", optionB: "躺一起刷手机" },
  { prompt: "私密空间里你更？", optionA: "希望有人靠近", optionB: "需要边界感" },
  { prompt: "香薰味道，你更？", optionA: "香薰暧昧", optionB: "简单干净" },
  { prompt: "冰箱囤货，你更？", optionA: "想被抱着", optionB: "先独处" },
  { prompt: "睡前护肤，你更？", optionA: "云吃外卖", optionB: "翻冰箱" },
  { prompt: "居家自拍，你更？", optionA: "拍氛围照", optionB: "写日记" },
  { prompt: "独处听歌，你更？", optionA: "看TA消息", optionB: "安静醒神" },
  { prompt: "周末打扫，你更？", optionA: "窝沙发", optionB: "听雨发呆" },
  { prompt: "夜间零食，你更？", optionA: "家居服多", optionB: "战袍多" },
  { prompt: "居家办公，你更？", optionA: "想怎么穿", optionB: "怕太黏人" },
  { prompt: "睡衣风格，你更？", optionA: "说真心话", optionB: "胡思乱想" },
  { prompt: "阳台发呆，你更？", optionA: "互道晚安", optionB: "见面打扮" },
  { prompt: "睡前刷手机，你更？", optionA: "怕不自在", optionB: "怕太随便" },
  { prompt: "独居安全感，你更？", optionA: "有人陪", optionB: "要独处" },
  { prompt: "居家运动，你更？", optionA: "想帮吹", optionB: "自己来" },
  { prompt: "夜间开窗，你更？", optionA: "赖床抱抱", optionB: "早起早餐" },
  { prompt: "居家香氛，你更？", optionA: "分享梗", optionB: "安静沉浸" },
  { prompt: "独处写日记，你更？", optionA: "刷剧很晚", optionB: "听歌想人" },
  { prompt: "周末补觉，你更？", optionA: "慵懒睡衣", optionB: "精致居家" },
  { prompt: "居家咖啡，你更？", optionA: "聊天才睡", optionB: "留点空间" },
  { prompt: "夜间想人，你更？", optionA: "分享自拍", optionB: "窝被不想动" },
  { prompt: "居家收纳，你更？", optionA: "补觉自然醒", optionB: "出门散心" },
  { prompt: "睡前热水澡，你更？", optionA: "香薰暧昧", optionB: "简单干净" },
  { prompt: "独处冥想，你更？", optionA: "想被抱着", optionB: "先独处" },
  { prompt: "居家宠物，你更？", optionA: "云吃外卖", optionB: "翻冰箱" },
  { prompt: "夜间读书，你更？", optionA: "拍氛围照", optionB: "写日记" },
  { prompt: "居家火锅，你更？", optionA: "看TA消息", optionB: "安静醒神" }
];

const LOVE_QUESTIONS = [
  { prompt: "心动瞬间你更吃？", optionA: "眼神对视太久", optionB: "不经意肢体碰触" },
  { prompt: "第一次想亲吻通常在？", optionA: "气氛突然上头", optionB: "分别舍不得时" },
  { prompt: "拥抱时你更？", optionA: "抱紧不想松手", optionB: "轻轻靠着就好" },
  { prompt: "接吻氛围你更选？", optionA: "安静只有呼吸", optionB: "音乐很轻灯光暗" },
  { prompt: "更受不了哪种靠近？", optionA: "脖颈被轻吻", optionB: "整个人被抱紧" },
  { prompt: "亲密时你更在意？", optionA: "对方尊重节奏", optionB: "彼此都很投入" },
  { prompt: "过夜你更期待？", optionA: "聊天到天亮", optionB: "拥抱入睡" },
  { prompt: "关系升温你更想？", optionA: "认真确认心意", optionB: "顺其自然发生" },
  { prompt: "看到对方什么会想亲？", optionA: "刚洗完澡的头发", optionB: "笑着看你说话" },
  { prompt: "更想被怎样坚定选择？", optionA: "说只喜欢你", optionB: "把你放进计划里" },
  { prompt: "亲密后你更希望？", optionA: "继续抱着你", optionB: "轻声说喜欢你" },
  { prompt: "理想亲密节奏你更？", optionA: "慢一点更有张力", optionB: "喜欢就直接表达" },
  { prompt: "哪种情话更上头？", optionA: "我很想你", optionB: "我只想和你在一起" },
  { prompt: "身体接触你更？", optionA: "循序渐进", optionB: "气氛到了就可以" },
  { prompt: "更向往的亲密夜晚？", optionA: "电影看到一半亲热", optionB: "什么都不做只拥抱" },
  { prompt: "占有欲你更？", optionA: "适度吃醋可爱", optionB: "给空间也要专一" },
  { prompt: "想更进一步前你更？", optionA: "先聊清楚边界", optionB: "看感觉走" },
  { prompt: "更吃哪种欲望表达？", optionA: "克制但眼神很热", optionB: "半开玩笑半认真" },
  { prompt: "亲密互动你更保留？", optionA: "止于亲吻拥抱", optionB: "看双方安全感" },
  { prompt: "对方困时靠过来你更？", optionA: "立刻搂住", optionB: "轻轻摸头" },
  { prompt: "更想尝试哪种体验？", optionA: "旅行中的私密夜晚", optionB: "雨夜窝沙发亲热" },
  { prompt: "确认关系你更想？", optionA: "认真告白后拥抱", optionB: "亲密后坦诚感受" },
  { prompt: "哪种接触最腿软？", optionA: "贴着说话不离开", optionB: "突然拉进怀里" },
  { prompt: "亲密时最怕？", optionA: "对方太急躁", optionB: "事后变冷淡" },
  { prompt: "更想听到哪句坦白？", optionA: "对你有生理心动", optionB: "想认真占有你" },
  { prompt: "亲吻深度，你更？", optionA: "尊重节奏", optionB: "彼此投入" },
  { prompt: "亲密主动，你更？", optionA: "聊天天亮", optionB: "拥抱入睡" },
  { prompt: "事后温柔，你更？", optionA: "确认心意", optionB: "顺其自然" },
  { prompt: "亲密边界，你更？", optionA: "洗完澡", optionB: "笑着看你" },
  { prompt: "亲密时长，你更？", optionA: "说只喜欢", optionB: "放进计划" },
  { prompt: "晨间亲密，你更？", optionA: "继续抱着", optionB: "轻声喜欢" },
  { prompt: "亲密音乐，你更？", optionA: "慢有张力", optionB: "直接表达" },
  { prompt: "亲密灯光，你更？", optionA: "我很想你", optionB: "只想一起" },
  { prompt: "拥抱睡觉，你更？", optionA: "循序渐进", optionB: "气氛到了" },
  { prompt: "亲密后聊天，你更？", optionA: "电影亲热", optionB: "只拥抱" },
  { prompt: "敏感部位，你更？", optionA: "吃醋可爱", optionB: "空间专一" },
  { prompt: "亲密气味，你更？", optionA: "聊清边界", optionB: "看感觉" },
  { prompt: "吹头发，你更？", optionA: "眼神很热", optionB: "半开玩笑" },
  { prompt: "解开紧张，你更？", optionA: "止于亲吻", optionB: "看安全感" },
  { prompt: "亲密着装，你更？", optionA: "立刻搂住", optionB: "轻轻摸头" },
  { prompt: "突然亲你，你更？", optionA: "眼神太久", optionB: "肢体碰触" },
  { prompt: "哄进状态，你更？", optionA: "气氛上头", optionB: "分别舍不得" },
  { prompt: "亲密结尾，你更？", optionA: "抱紧不松", optionB: "轻轻靠着" },
  { prompt: "浪漫夜晚，你更？", optionA: "安静呼吸", optionB: "轻音乐暗光" },
  { prompt: "珍惜身体，你更？", optionA: "脖颈轻吻", optionB: "整个人抱紧" },
  { prompt: "亲密第二天，你更？", optionA: "尊重节奏", optionB: "彼此投入" },
  { prompt: "亲密日常，你更？", optionA: "聊天天亮", optionB: "拥抱入睡" },
  { prompt: "接吻手放哪，你更？", optionA: "确认心意", optionB: "顺其自然" },
  { prompt: "害羞程度，你更？", optionA: "洗完澡", optionB: "笑着看你" },
  { prompt: "慢热亲密，你更？", optionA: "说只喜欢", optionB: "放进计划" }
];

const FUN_QUESTIONS = [
  { prompt: "约会娱乐你更？", optionA: "私密影院包厢", optionB: "夜市边走边吃" },
  { prompt: "一起看电影你更？", optionA: "爱情暧昧片", optionB: "搞笑轻松片" },
  { prompt: "深夜消遣你更？", optionA: "连麦打游戏", optionB: "一起点夜宵" },
  { prompt: "KTV 你更？", optionA: "对唱情歌", optionB: "搞怪嗨到很晚" },
  { prompt: "旅行住宿你更？", optionA: "氛围感民宿", optionB: "方便出行的酒店" },
  { prompt: "周末娱乐你更？", optionA: "探店拍照", optionB: "宅家看剧" },
  { prompt: "暧昧片单你更？", optionA: "日系慢热爱情", optionB: "张力强的欧美片" },
  { prompt: "游戏互动你更？", optionA: "双人默契类", optionB: "竞争性小游戏" },
  { prompt: "节日安排你更？", optionA: "两人独处过节", optionB: "朋友一起热闹" },
  { prompt: "下雨天约会你更？", optionA: "咖啡馆靠窗", optionB: "家里火锅电影" },
  { prompt: "夜生活你更？", optionA: "小酒吧听歌", optionB: "散步聊天回家" },
  { prompt: "一起拍照你更？", optionA: "自然抓拍", optionB: "精致氛围感" },
  { prompt: "看展逛馆你更？", optionA: "牵手慢慢看", optionB: "各看各的再分享" },
  { prompt: "宵夜你更？", optionA: "路边摊烟火气", optionB: "安静日料小馆" },
  { prompt: "长途车上你更？", optionA: "靠肩睡觉", optionB: "一起听歌看风景" },
  { prompt: "游乐园你更？", optionA: "摩天轮夜景", optionB: "刺激项目尖叫" },
  { prompt: "暧昧BGM你更？", optionA: "慢节奏R&B", optionB: "复古情歌" },
  { prompt: "聚会后你更？", optionA: "两人单独续摊", optionB: "直接回家聊天" },
  { prompt: "旅行拍照你更？", optionA: "合照要亲密一点", optionB: "风景人像各一半" },
  { prompt: "看球/演出你更？", optionA: "牵手欢呼", optionB: "安静专注再看" },
  { prompt: "密室逃脱你更？", optionA: "故意吓对方", optionB: "认真解谜" },
  { prompt: "海边夜晚你更？", optionA: "散步听浪", optionB: "坐着聊天到很晚" },
  { prompt: "一起下厨你更？", optionA: "互相喂一口", optionB: "比赛谁做得更好" },
  { prompt: "暧昧游戏你更？", optionA: "真心话带点尺度", optionB: "默契二选一" },
  { prompt: "深夜开车兜风你更？", optionA: "开窗放老歌", optionB: "安静聊心事" },
  { prompt: "酒吧小酌，你更？", optionA: "探店拍照", optionB: "宅家看剧" },
  { prompt: "咖啡约会，你更？", optionA: "日系慢热", optionB: "张力欧美" },
  { prompt: "夜市逛街，你更？", optionA: "默契游戏", optionB: "竞技小游戏" },
  { prompt: "桌游夜，你更？", optionA: "两人过节", optionB: "朋友热闹" },
  { prompt: "露营星空，你更？", optionA: "咖啡馆", optionB: "火锅电影" },
  { prompt: "滑雪度假，你更？", optionA: "小酒吧", optionB: "散步回家" },
  { prompt: "温泉旅行，你更？", optionA: "自然抓拍", optionB: "精致摆拍" },
  { prompt: "演唱会，你更？", optionA: "牵手慢看", optionB: "各看各分享" },
  { prompt: "剧本杀，你更？", optionA: "路边摊", optionB: "日料小馆" },
  { prompt: "电玩城，你更？", optionA: "靠肩睡", optionB: "听歌看景" },
  { prompt: "野餐，你更？", optionA: "摩天轮", optionB: "刺激尖叫" },
  { prompt: "骑行，你更？", optionA: "慢R&B", optionB: "复古情歌" },
  { prompt: "摄影扫街，你更？", optionA: "单独续摊", optionB: "回家聊天" },
  { prompt: "livehouse，你更？", optionA: "亲密合照", optionB: "风景人像" },
  { prompt: "脱口秀，你更？", optionA: "牵手欢呼", optionB: "安静专注" },
  { prompt: "逛书店，你更？", optionA: "私密影院", optionB: "夜市边走边吃" },
  { prompt: "逛花市，你更？", optionA: "爱情暧昧片", optionB: "搞笑轻松片" },
  { prompt: "做手工，你更？", optionA: "连麦游戏", optionB: "点夜宵" },
  { prompt: "烘焙，你更？", optionA: "对唱情歌", optionB: "搞怪嗨" },
  { prompt: "跳舞，你更？", optionA: "氛围民宿", optionB: "方便酒店" },
  { prompt: "游泳，你更？", optionA: "探店拍照", optionB: "宅家看剧" },
  { prompt: "爬山，你更？", optionA: "日系慢热", optionB: "张力欧美" },
  { prompt: "钓鱼，你更？", optionA: "默契游戏", optionB: "竞技小游戏" },
  { prompt: "逛博物馆，你更？", optionA: "两人过节", optionB: "朋友热闹" },
  { prompt: "坐摩天轮，你更？", optionA: "咖啡馆", optionB: "火锅电影" }
];

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
