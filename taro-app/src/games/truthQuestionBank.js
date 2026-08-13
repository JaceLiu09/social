export const TRUTH_STYLE_OPTIONS = [
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
  {
    difficulty: "FLIRT",
    question: "哪种消息会让你立刻心跳加速？",
    options: ["深夜突然说想你","发仅你可见的照片","语音里带点撒娇","故意慢回吊着你"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧聊天时，你最受不了对方？",
    options: ["若即若离的节奏","只对你一个人温柔","认真夸你某个细节","开一点尺度玩笑"]
  },
  {
    difficulty: "FLIRT",
    question: "第一次觉得“有点上头”通常是因为？",
    options: ["眼神对视太久","不经意碰到手","记得我说过的小事","深夜聊得太投入"]
  },
  {
    difficulty: "FLIRT",
    question: "你更喜欢哪种撩法？",
    options: ["嘴上逗你其实认真","行动派直接靠近","温柔克制慢慢升温","坏坏的反差感"]
  },
  {
    difficulty: "FLIRT",
    question: "线上聊到哪种程度会想见面？",
    options: ["互发过素颜照","说过想抱抱","聊过喜欢怎样的亲密","已经连麦到半夜"]
  },
  {
    difficulty: "FLIRT",
    question: "对方做什么会让你瞬间脸红？",
    options: ["突然叫亲昵称呼","认真说你很特别","发暧昧表情包","说只对你这样"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧期你最想确认的是？",
    options: ["TA是不是也心动","我们算不算特别","能不能再靠近一点","TA有没有别人"]
  },
  {
    difficulty: "FLIRT",
    question: "约会时哪种氛围最撩你？",
    options: ["灯光偏暗的角落","并肩走路靠很近","饭后散步吹风","只有两个人的空间"]
  },
  {
    difficulty: "FLIRT",
    question: "你更吃哪一种靠近方式？",
    options: ["过马路自然牵手","低头帮你整理衣领","并肩时手臂轻碰","气氛到了主动抱一下"]
  },
  {
    difficulty: "FLIRT",
    question: "被撩到时你的第一反应是？",
    options: ["反撩回去","装淡定其实心动","立刻想见对方","故意吊着对方"]
  },
  {
    difficulty: "FLIRT",
    question: "哪种“小动作”最加分？",
    options: ["摸头或揉头发","认真盯着眼睛说话","递东西时指尖碰触","帮你挡风或拉外套"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧升温最快的方式是？",
    options: ["分享私密歌单","互发生活碎片","深夜走心到脸红","见面时肢体距离缩短"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧称呼，你更？",
    options: ["继续发可爱表情","也晾着TA一会","直接问什么意思","假装不在意其实在意"]
  },
  {
    difficulty: "FLIRT",
    question: "聊天到半夜，你更？",
    options: ["只给你起外号","存你照片当背景","置顶你的聊天","偷偷改亲密称呼"]
  },
  {
    difficulty: "FLIRT",
    question: "哪种道歉最心软，你更？",
    options: ["回家回味每个细节","立刻发消息延续","忍住等对方先找","跟朋友偷偷分享"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧时你更会，你更？",
    options: ["笑着看你太久","扫过你又移开","认真到像告白","带着点坏笑"]
  },
  {
    difficulty: "FLIRT",
    question: "你更吃哪种反差，你更？",
    options: ["爱发低沉那几句","更爱打字留想象","突然来电更心动","半夜语音最上头"]
  },
  {
    difficulty: "FLIRT",
    question: "被问想我没，你更？",
    options: ["害羞说别看了","顺势开暧昧玩笑","认真道谢并回夸","假装生气其实开心"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧电影约会，你更？",
    options: ["同住但慢慢来","分开住白天约会","随性走到哪算哪","提前规划浪漫惊喜"]
  },
  {
    difficulty: "FLIRT",
    question: "对方分享歌单，你更？",
    options: ["忽冷忽热","只撩不负责","暧昧却不确认","对你和别人双标"]
  },
  {
    difficulty: "FLIRT",
    question: "你更喜欢的试探，你更？",
    options: ["发合照但不官宣","只发暗示文案","私下给你专属分享","完全低调保护你"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧牵手，你更？",
    options: ["抢着表现诚意","自然轮流更舒服","喜欢被照顾一次","不在意谁付"]
  },
  {
    difficulty: "FLIRT",
    question: "被说你今天好香，你更？",
    options: ["手写情话卡片","记得你爱的小物","突然送花不解释","实用里藏小心思"]
  },
  {
    difficulty: "FLIRT",
    question: "你更怕哪种暧昧结局，你更？",
    options: ["心跳漏一拍","故作镇定反撩","微微后退留张力","直接迎上去"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧期见面频率，你更？",
    options: ["继续发可爱表情","也晾着TA一会","直接问什么意思","假装不在意其实在意"]
  },
  {
    difficulty: "FLIRT",
    question: "哪种已读最折磨，你更？",
    options: ["只给你起外号","存你照片当背景","置顶你的聊天","偷偷改亲密称呼"]
  },
  {
    difficulty: "FLIRT",
    question: "你更喜欢的开场白，你更？",
    options: ["回家回味每个细节","立刻发消息延续","忍住等对方先找","跟朋友偷偷分享"]
  },
  {
    difficulty: "FLIRT",
    question: "对方夸你性格，你更？",
    options: ["笑着看你太久","扫过你又移开","认真到像告白","带着点坏笑"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧自拍，你更？",
    options: ["爱发低沉那几句","更爱打字留想象","突然来电更心动","半夜语音最上头"]
  },
  {
    difficulty: "FLIRT",
    question: "你更吃哪种保护欲，你更？",
    options: ["害羞说别看了","顺势开暧昧玩笑","认真道谢并回夸","假装生气其实开心"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧时吃醋，你更？",
    options: ["同住但慢慢来","分开住白天约会","随性走到哪算哪","提前规划浪漫惊喜"]
  },
  {
    difficulty: "FLIRT",
    question: "你更想被怎样记住，你更？",
    options: ["忽冷忽热","只撩不负责","暧昧却不确认","对你和别人双标"]
  },
  {
    difficulty: "FLIRT",
    question: "深夜睡了吗，你更？",
    options: ["发合照但不官宣","只发暗示文案","私下给你专属分享","完全低调保护你"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧拥抱时长，你更？",
    options: ["抢着表现诚意","自然轮流更舒服","喜欢被照顾一次","不在意谁付"]
  },
  {
    difficulty: "FLIRT",
    question: "你更喜欢的暧昧节奏，你更？",
    options: ["手写情话卡片","记得你爱的小物","突然送花不解释","实用里藏小心思"]
  },
  {
    difficulty: "FLIRT",
    question: "对方突然说想见你，你更？",
    options: ["心跳漏一拍","故作镇定反撩","微微后退留张力","直接迎上去"]
  },
  {
    difficulty: "FLIRT",
    question: "你更受不了哪种敷衍，你更？",
    options: ["继续发可爱表情","也晾着TA一会","直接问什么意思","假装不在意其实在意"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧时你愿分享，你更？",
    options: ["只给你起外号","存你照片当背景","置顶你的聊天","偷偷改亲密称呼"]
  },
  {
    difficulty: "FLIRT",
    question: "对方只对你温柔，你更？",
    options: ["回家回味每个细节","立刻发消息延续","忍住等对方先找","跟朋友偷偷分享"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧里你更主动还是被动，你更？",
    options: ["笑着看你太久","扫过你又移开","认真到像告白","带着点坏笑"]
  },
  {
    difficulty: "FLIRT",
    question: "被说特别，你更？",
    options: ["爱发低沉那几句","更爱打字留想象","突然来电更心动","半夜语音最上头"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧期节日，你更？",
    options: ["害羞说别看了","顺势开暧昧玩笑","认真道谢并回夸","假装生气其实开心"]
  },
  {
    difficulty: "FLIRT",
    question: "你更喜欢的距离感，你更？",
    options: ["同住但慢慢来","分开住白天约会","随性走到哪算哪","提前规划浪漫惊喜"]
  },
  {
    difficulty: "FLIRT",
    question: "对方突然沉默，你更？",
    options: ["忽冷忽热","只撩不负责","暧昧却不确认","对你和别人双标"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧里谁先表白，你更？",
    options: ["发合照但不官宣","只发暗示文案","私下给你专属分享","完全低调保护你"]
  },
  {
    difficulty: "FLIRT",
    question: "你更吃哪种眼神，你更？",
    options: ["抢着表现诚意","自然轮流更舒服","喜欢被照顾一次","不在意谁付"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧时会不会吃醋，你更？",
    options: ["手写情话卡片","记得你爱的小物","突然送花不解释","实用里藏小心思"]
  },
  {
    difficulty: "FLIRT",
    question: "你更喜欢的聊天结尾，你更？",
    options: ["心跳漏一拍","故作镇定反撩","微微后退留张力","直接迎上去"]
  },
  {
    difficulty: "FLIRT",
    question: "对方发暧昧歌，你更？",
    options: ["继续发可爱表情","也晾着TA一会","直接问什么意思","假装不在意其实在意"]
  },
  {
    difficulty: "FLIRT",
    question: "暧昧时会不会幻想见面，你更？",
    options: ["只给你起外号","存你照片当背景","置顶你的聊天","偷偷改亲密称呼"]
  },
  {
    difficulty: "DESIRE",
    question: "你最吃对方哪一款气质？",
    options: ["痞帅会撩","温柔克制","成熟稳重","爱笑黏人"]
  },
  {
    difficulty: "DESIRE",
    question: "如果只能选一个亲密动作起步？",
    options: ["十指紧扣","从背后抱住","额头贴额头","认真接吻"]
  },
  {
    difficulty: "DESIRE",
    question: "你更在意伴侣哪一点？",
    options: ["只对你热情","情绪稳定会哄人","有主见也尊重你","愿意为你花时间"]
  },
  {
    difficulty: "DESIRE",
    question: "看到对方什么瞬间会想亲上去？",
    options: ["刚洗完澡的头发","认真做饭的背影","困了就靠过来","笑着看你说话"]
  },
  {
    difficulty: "DESIRE",
    question: "你更喜欢的相处占有欲是？",
    options: ["适度吃醋很可爱","给彼此空间也专一","公开宣示主权","不太在意这些"]
  },
  {
    difficulty: "DESIRE",
    question: "深夜独处时你最常想起对方什么？",
    options: ["TA的声音和语气","拥抱时的温度","某次心动对视","还没兑现的约会"]
  },
  {
    difficulty: "DESIRE",
    question: "你更想被怎样坚定地选择？",
    options: ["认真说只喜欢你","把你介绍给朋友","为你调整安排","吵架后仍站在你这边"]
  },
  {
    difficulty: "DESIRE",
    question: "哪种夸奖最让你心软？",
    options: ["夸你好看或性感","夸你性格可爱","夸你让人安心","夸你让人想保护"]
  },
  {
    difficulty: "DESIRE",
    question: "理想型里最难抗拒的是？",
    options: ["声音好听","身材线条好看","笑起来很治愈","认真时很迷人"]
  },
  {
    difficulty: "DESIRE",
    question: "如果只能保留一种亲密互动？",
    options: ["长时间拥抱","亲吻","依偎着聊天","一起洗澡前后那种暧昧"]
  },
  {
    difficulty: "DESIRE",
    question: "你更想听到哪句话？",
    options: ["我很想你","我只想和你在一起","你让我很心动","今晚别走了"]
  },
  {
    difficulty: "DESIRE",
    question: "对方哪种“偏心”最打动你？",
    options: ["只对你温柔","只对你坏笑","只对你撒娇","只对你坦白脆弱"]
  },
  {
    difficulty: "DESIRE",
    question: "你更想保留什么神秘，你更？",
    options: ["先轻再深","突然但很温柔","边聊边靠近","分别时忍不住"]
  },
  {
    difficulty: "DESIRE",
    question: "亲密称呼，你更？",
    options: ["低沉耳边语","笑起来的气音","认真说话很稳","撒娇尾音"]
  },
  {
    difficulty: "DESIRE",
    question: "你更怕哪种心动，你更？",
    options: ["想公开关系","想独占一晚","想确认你也上头","想立刻见面"]
  },
  {
    difficulty: "DESIRE",
    question: "哪种照顾最戳你，你更？",
    options: ["干净白衬衫","休闲家居感","约会精心打扮","运动完微汗"]
  },
  {
    difficulty: "DESIRE",
    question: "你更想被怎样追求，你更？",
    options: ["只对你坏笑","只对你温柔","只对你撒娇","只对你坦白"]
  },
  {
    difficulty: "DESIRE",
    question: "对方认真看你时，你更？",
    options: ["翻聊天记录","想象下次见面","发消息试探","听歌想到TA"]
  },
  {
    difficulty: "DESIRE",
    question: "你更喜欢的偏心细节，你更？",
    options: ["灵魂共鸣优先","两者都要","先心动再谈身体","化学反应很重要"]
  },
  {
    difficulty: "DESIRE",
    question: "心动后你更常，你更？",
    options: ["脖颈轻触","腰被搂住","额头相抵","背后被抱住"]
  },
  {
    difficulty: "DESIRE",
    question: "你更吃哪种成熟，你更？",
    options: ["只想和你在一起","认真交往不玩玩","会慢慢对你更好","现在就很在意你"]
  },
  {
    difficulty: "DESIRE",
    question: "哪种拥抱你更想，你更？",
    options: ["喜欢被环抱","平视最舒服","不在意这些","喜欢仰头看对方"]
  },
  {
    difficulty: "DESIRE",
    question: "你更想被夸哪里，你更？",
    options: ["记得你说的话","为你改计划","吵架仍站你这边","把你介绍给朋友"]
  },
  {
    difficulty: "DESIRE",
    question: "暧昧升级恋爱，你更？",
    options: ["有点吃醋正常","希望TA主动解释","相信自己很特别","直接表达介意"]
  },
  {
    difficulty: "DESIRE",
    question: "你更受不了哪种冷淡，你更？",
    options: ["先轻再深","突然但很温柔","边聊边靠近","分别时忍不住"]
  },
  {
    difficulty: "DESIRE",
    question: "理想约会结尾，你更？",
    options: ["低沉耳边语","笑起来的气音","认真说话很稳","撒娇尾音"]
  },
  {
    difficulty: "DESIRE",
    question: "你更想被怎样坚定选择，你更？",
    options: ["想公开关系","想独占一晚","想确认你也上头","想立刻见面"]
  },
  {
    difficulty: "DESIRE",
    question: "哪种气味更上头，你更？",
    options: ["干净白衬衫","休闲家居感","约会精心打扮","运动完微汗"]
  },
  {
    difficulty: "DESIRE",
    question: "你更喜欢的黏人度，你更？",
    options: ["只对你坏笑","只对你温柔","只对你撒娇","只对你坦白"]
  },
  {
    difficulty: "DESIRE",
    question: "对方脆弱时，你更？",
    options: ["翻聊天记录","想象下次见面","发消息试探","听歌想到TA"]
  },
  {
    difficulty: "DESIRE",
    question: "你更吃哪种坏笑，你更？",
    options: ["灵魂共鸣优先","两者都要","先心动再谈身体","化学反应很重要"]
  },
  {
    difficulty: "DESIRE",
    question: "心动证据你更信，你更？",
    options: ["脖颈轻触","腰被搂住","额头相抵","背后被抱住"]
  },
  {
    difficulty: "DESIRE",
    question: "你更想怎样被想念，你更？",
    options: ["只想和你在一起","认真交往不玩玩","会慢慢对你更好","现在就很在意你"]
  },
  {
    difficulty: "DESIRE",
    question: "哪种距离最暧昧，你更？",
    options: ["喜欢被环抱","平视最舒服","不在意这些","喜欢仰头看对方"]
  },
  {
    difficulty: "DESIRE",
    question: "你更怕失去什么，你更？",
    options: ["记得你说的话","为你改计划","吵架仍站你这边","把你介绍给朋友"]
  },
  {
    difficulty: "DESIRE",
    question: "对方主动牵你，你更？",
    options: ["有点吃醋正常","希望TA主动解释","相信自己很特别","直接表达介意"]
  },
  {
    difficulty: "DESIRE",
    question: "你更喜欢的惊喜频率，你更？",
    options: ["先轻再深","突然但很温柔","边聊边靠近","分别时忍不住"]
  },
  {
    difficulty: "DESIRE",
    question: "哪种告白你更吃，你更？",
    options: ["低沉耳边语","笑起来的气音","认真说话很稳","撒娇尾音"]
  },
  {
    difficulty: "DESIRE",
    question: "你更想被怎样珍惜，你更？",
    options: ["想公开关系","想独占一晚","想确认你也上头","想立刻见面"]
  },
  {
    difficulty: "DESIRE",
    question: "理想型气质，你更？",
    options: ["干净白衬衫","休闲家居感","约会精心打扮","运动完微汗"]
  },
  {
    difficulty: "DESIRE",
    question: "你更在意专一还是浪漫，你更？",
    options: ["只对你坏笑","只对你温柔","只对你撒娇","只对你坦白"]
  },
  {
    difficulty: "DESIRE",
    question: "对方记得小事，你更？",
    options: ["翻聊天记录","想象下次见面","发消息试探","听歌想到TA"]
  },
  {
    difficulty: "DESIRE",
    question: "你更喜欢的占有欲，你更？",
    options: ["灵魂共鸣优先","两者都要","先心动再谈身体","化学反应很重要"]
  },
  {
    difficulty: "DESIRE",
    question: "心动时会不会主动，你更？",
    options: ["脖颈轻触","腰被搂住","额头相抵","背后被抱住"]
  },
  {
    difficulty: "DESIRE",
    question: "你更吃哪种安全感，你更？",
    options: ["只想和你在一起","认真交往不玩玩","会慢慢对你更好","现在就很在意你"]
  },
  {
    difficulty: "DESIRE",
    question: "对方为你改变计划，你更？",
    options: ["喜欢被环抱","平视最舒服","不在意这些","喜欢仰头看对方"]
  },
  {
    difficulty: "DESIRE",
    question: "你更想听哪句偏心话，你更？",
    options: ["记得你说的话","为你改计划","吵架仍站你这边","把你介绍给朋友"]
  },
  {
    difficulty: "DESIRE",
    question: "看到TA笑，你更？",
    options: ["有点吃醋正常","希望TA主动解释","相信自己很特别","直接表达介意"]
  },
  {
    difficulty: "DESIRE",
    question: "你更喜欢的约会频率，你更？",
    options: ["先轻再深","突然但很温柔","边聊边靠近","分别时忍不住"]
  },
  {
    difficulty: "DESIRE",
    question: "对方紧张时，你更？",
    options: ["低沉耳边语","笑起来的气音","认真说话很稳","撒娇尾音"]
  },
  {
    difficulty: "INTIMATE",
    question: "关系升温时你更想？",
    options: ["延长拥抱时间","认真接吻不敷衍","一起过夜纯聊天","探索彼此喜好边界"]
  },
  {
    difficulty: "INTIMATE",
    question: "什么画面会让你想立刻靠近？",
    options: ["刚运动完微喘","穿宽松衣服居家","低头靠近你耳朵说话","困了就窝进怀里"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更喜欢的接吻氛围是？",
    options: ["安静只有呼吸声","音乐很轻灯光暗","分别前舍不得","气氛突然上头"]
  },
  {
    difficulty: "INTIMATE",
    question: "第一次过夜你更期待？",
    options: ["聊天到天亮","拥抱入睡","循序渐进更亲密","看对方真实生活习惯"]
  },
  {
    difficulty: "INTIMATE",
    question: "哪种肢体接触最让你上头？",
    options: ["脖颈被轻吻","腰被搂住","手指穿过头发","整个人被抱紧"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密时你最在意？",
    options: ["对方是否尊重节奏","氛围是否安全放松","有没有被认真对待","彼此都投入当下"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更想怎样确认彼此心意？",
    options: ["认真告白后拥抱","亲密后坦诚感受","一起规划下次见面","把关系说得更清楚"]
  },
  {
    difficulty: "INTIMATE",
    question: "哪种“靠近”会让你腿软？",
    options: ["耳边低声说想你","从背后环住腰","额头相抵不说话","吻到喘不过气"]
  },
  {
    difficulty: "INTIMATE",
    question: "更私密的相处里你更看重？",
    options: ["温柔和耐心","主动但不强势","会沟通边界","事后依然黏你"]
  },
  {
    difficulty: "INTIMATE",
    question: "什么会让你想更进一步？",
    options: ["彼此眼神都很认真","已经聊过期待和底线","气氛自然不尴尬","对方让你很有安全感"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密后你最希望对方？",
    options: ["继续抱着你","认真问你感受","轻声说喜欢你","一起安静待一会儿"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更向往哪种夜晚？",
    options: ["电影看到一半亲热","洗完澡互相吹头发","躺床上聊心事","什么都不做只拥抱"]
  },
  {
    difficulty: "INTIMATE",
    question: "对方问可以吗，你更？",
    options: ["立刻拥抱","慢慢聊天","继续散步装淡定","想亲但忍住"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更喜欢的体温差，你更？",
    options: ["喜欢对方主动","自己来更自然","互相试探靠近","看气氛谁都可以"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密时眼神，你更？",
    options: ["聊过去和未来","聊喜欢怎样的亲密","聊日常碎碎念","聊到后来安静抱"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更想在哪亲密，你更？",
    options: ["暖黄暧昧","只留小夜灯","自然光也OK","黑暗靠触感"]
  },
  {
    difficulty: "INTIMATE",
    question: "接吻深度，你更？",
    options: ["轻声夸对方","少说专注感受","偶尔逗一下","认真问舒不舒服"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更怕亲密时，你更？",
    options: ["整个人窝怀里","背后被环住","面对面腿缠住","各睡各的但牵手"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密后聊天，你更？",
    options: ["醒来先抱一会","亲吻说早安","一起赖床","做早餐也甜蜜"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更喜欢的亲密气味，你更？",
    options: ["继续温存","聊天确认感受","一起洗澡","安静躺一会"]
  },
  {
    difficulty: "INTIMATE",
    question: "对方帮你吹头发，你更？",
    options: ["耳后","后颈","腰侧","手心"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更想被怎样解开紧张，你更？",
    options: ["慢节奏R&B","没有音乐更专注","轻爵士","对方歌单"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密边界，你更？",
    options: ["直接说慢一点","用动作示意","勉强配合","事后才表达"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更喜欢的亲密时长，你更？",
    options: ["长时间亲吻","拥抱不分开","一起泡澡聊天","循序渐进更深"]
  },
  {
    difficulty: "INTIMATE",
    question: "对方事后黏你，你更？",
    options: ["立刻拥抱","慢慢聊天","继续散步装淡定","想亲但忍住"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更想尝试的亲密氛围，你更？",
    options: ["喜欢对方主动","自己来更自然","互相试探靠近","看气氛谁都可以"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密时主动方，你更？",
    options: ["聊过去和未来","聊喜欢怎样的亲密","聊日常碎碎念","聊到后来安静抱"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更吃哪种事后温柔，你更？",
    options: ["暖黄暧昧","只留小夜灯","自然光也OK","黑暗靠触感"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密中学习对方，你更？",
    options: ["轻声夸对方","少说专注感受","偶尔逗一下","认真问舒不舒服"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更喜欢的亲密着装，你更？",
    options: ["整个人窝怀里","背后被环住","面对面腿缠住","各睡各的但牵手"]
  },
  {
    difficulty: "INTIMATE",
    question: "对方突然亲你，你更？",
    options: ["醒来先抱一会","亲吻说早安","一起赖床","做早餐也甜蜜"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更想被怎样哄进状态，你更？",
    options: ["继续温存","聊天确认感受","一起洗澡","安静躺一会"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密时最怕听到，你更？",
    options: ["耳后","后颈","腰侧","手心"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更喜欢的亲密结尾，你更？",
    options: ["慢节奏R&B","没有音乐更专注","轻爵士","对方歌单"]
  },
  {
    difficulty: "INTIMATE",
    question: "哪种亲密更浪漫，你更？",
    options: ["直接说慢一点","用动作示意","勉强配合","事后才表达"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更想被怎样珍惜身体，你更？",
    options: ["长时间亲吻","拥抱不分开","一起泡澡聊天","循序渐进更深"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密后第二天，你更？",
    options: ["立刻拥抱","慢慢聊天","继续散步装淡定","想亲但忍住"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更向往的亲密日常，你更？",
    options: ["喜欢对方主动","自己来更自然","互相试探靠近","看气氛谁都可以"]
  },
  {
    difficulty: "INTIMATE",
    question: "拥抱和亲吻频率，你更？",
    options: ["聊过去和未来","聊喜欢怎样的亲密","聊日常碎碎念","聊到后来安静抱"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更喜欢的亲密温度，你更？",
    options: ["暖黄暧昧","只留小夜灯","自然光也OK","黑暗靠触感"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密时会不会害羞，你更？",
    options: ["轻声夸对方","少说专注感受","偶尔逗一下","认真问舒不舒服"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更想被怎样抱着，你更？",
    options: ["整个人窝怀里","背后被环住","面对面腿缠住","各睡各的但牵手"]
  },
  {
    difficulty: "INTIMATE",
    question: "接吻时手放哪，你更？",
    options: ["醒来先抱一会","亲吻说早安","一起赖床","做早餐也甜蜜"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更喜欢的亲密开场，你更？",
    options: ["继续温存","聊天确认感受","一起洗澡","安静躺一会"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密时会不会说话，你更？",
    options: ["耳后","后颈","腰侧","手心"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更想在哪过夜聊天，你更？",
    options: ["慢节奏R&B","没有音乐更专注","轻爵士","对方歌单"]
  },
  {
    difficulty: "INTIMATE",
    question: "亲密时会不会主动，你更？",
    options: ["直接说慢一点","用动作示意","勉强配合","事后才表达"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更喜欢的慢节奏，你更？",
    options: ["长时间亲吻","拥抱不分开","一起泡澡聊天","循序渐进更深"]
  },
  {
    difficulty: "INTIMATE",
    question: "对方尊重你节奏，你更？",
    options: ["立刻拥抱","慢慢聊天","继续散步装淡定","想亲但忍住"]
  },
  {
    difficulty: "INTIMATE",
    question: "你更想被怎样安慰，你更？",
    options: ["喜欢对方主动","自己来更自然","互相试探靠近","看气氛谁都可以"]
  },
  {
    difficulty: "BOLD",
    question: "你敢承认自己最想的亲密尺度是？",
    options: ["止于亲吻拥抱","过夜但循序渐进","更进一步需确认","完全看感觉走"]
  },
  {
    difficulty: "BOLD",
    question: "哪种“坏心思”你其实不反感？",
    options: ["故意撩到你脸红","说想独占你一晚","突然把你拉进怀里","认真问你想不想更近"]
  },
  {
    difficulty: "BOLD",
    question: "你最怕亲密时发生什么？",
    options: ["对方太急躁","气氛尴尬冷场","事后变得冷淡","边界被忽视"]
  },
  {
    difficulty: "BOLD",
    question: "如果真心话要更直白，你会先聊？",
    options: ["彼此喜欢怎样的亲密","什么绝对不能接受","前任阴影和底线","现在最想对TA做什么"]
  },
  {
    difficulty: "BOLD",
    question: "你更吃哪一种“欲望表达”？",
    options: ["克制但眼神很热","直接说想要你","用行动慢慢试探","半开玩笑半认真"]
  },
  {
    difficulty: "BOLD",
    question: "什么情况下你会主动更进一步？",
    options: ["确认彼此互相喜欢","气氛已经很明显","对方给足安全感","自己实在忍不住了"]
  },
  {
    difficulty: "BOLD",
    question: "你更想尝试哪种亲密体验？",
    options: ["角色扮演式暧昧","旅行中的私密夜晚","雨夜窝在沙发亲热","清晨醒来的拥抱"]
  },
  {
    difficulty: "BOLD",
    question: "关于身体接触，你更认同？",
    options: ["慢一点更有张力","喜欢就直接表达","要先聊清楚边界","亲密是感情的自然结果"]
  },
  {
    difficulty: "BOLD",
    question: "哪种坦白会让你更心动？",
    options: ["我承认很想你","我对你有欲望","我只想碰你","我想认真交往也想要你"]
  },
  {
    difficulty: "BOLD",
    question: "如果今晚只有你们两个人？",
    options: ["聊天到深夜","看电影自然亲热","一起洗澡前后暧昧","顺其自然发生什么"]
  },
  {
    difficulty: "BOLD",
    question: "你更受不了哪种撩拨？",
    options: ["轻咬耳垂","手指划过后背","贴着说话不离开","突然把你按进怀里"]
  },
  {
    difficulty: "BOLD",
    question: "真心话里你最想听对方承认？",
    options: ["对你有生理心动","想过更亲密的画面","会吃醋也会克制","想认真占有你"]
  },
  {
    difficulty: "BOLD",
    question: "你更想被怎样占有，你更？",
    options: ["想抱抱","想接吻","想过夜聊天","想更进一步"]
  },
  {
    difficulty: "BOLD",
    question: "尺度升级信号，你更？",
    options: ["直接说想你","故意卖关子","凑近耳语","说你想听的那种"]
  },
  {
    difficulty: "BOLD",
    question: "你更怕哪种大胆，你更？",
    options: ["唇","脖颈","额头","手心"]
  },
  {
    difficulty: "BOLD",
    question: "亲密真心话你更敢问，你更？",
    options: ["雨夜沙发","旅行酒店","清晨被窝","电影院角落"]
  },
  {
    difficulty: "BOLD",
    question: "你更想在哪说想你，你更？",
    options: ["我现在很想你","我想抱你","我想亲你","我想和你更近"]
  },
  {
    difficulty: "BOLD",
    question: "对方突然留宿暗示，你更？",
    options: ["偶尔开一点","只私下开","不喜欢","互相接梗更好"]
  },
  {
    difficulty: "BOLD",
    question: "你更吃哪种坏，你更？",
    options: ["有点撩就够","越直白越上头","看气氛","行动大于语言"]
  },
  {
    difficulty: "BOLD",
    question: "亲密后坦白，你更？",
    options: ["心跳爆炸","反撩回去","假装嫌弃","直接亲上去"]
  },
  {
    difficulty: "BOLD",
    question: "你更想被怎样点名欲望，你更？",
    options: ["想被抱紧","想被亲久一点","想过夜","想确认专属关系"]
  },
  {
    difficulty: "BOLD",
    question: "大胆约会，你更？",
    options: ["交给对方","自己主导","轮流","默契就好"]
  },
  {
    difficulty: "BOLD",
    question: "你更敢主动到哪一步，你更？",
    options: ["半公开场合牵手","私密角色扮演","旅行陌生环境","都不想要"]
  },
  {
    difficulty: "BOLD",
    question: "对方问怕不怕，你更？",
    options: ["偏要继续一点","立刻收手","问那其实想要吗","换温柔方式"]
  },
  {
    difficulty: "BOLD",
    question: "你更想听哪种秘密，你更？",
    options: ["想抱抱","想接吻","想过夜聊天","想更进一步"]
  },
  {
    difficulty: "BOLD",
    question: "尺度游戏，你更？",
    options: ["直接说想你","故意卖关子","凑近耳语","说你想听的那种"]
  },
  {
    difficulty: "BOLD",
    question: "你更想被怎样逼问真心，你更？",
    options: ["唇","脖颈","额头","手心"]
  },
  {
    difficulty: "BOLD",
    question: "亲密时突然被打断，你更？",
    options: ["雨夜沙发","旅行酒店","清晨被窝","电影院角落"]
  },
  {
    difficulty: "BOLD",
    question: "你更敢发哪种消息，你更？",
    options: ["我现在很想你","我想抱你","我想亲你","我想和你更近"]
  },
  {
    difficulty: "BOLD",
    question: "对方说别诱惑我，你更？",
    options: ["偶尔开一点","只私下开","不喜欢","互相接梗更好"]
  },
  {
    difficulty: "BOLD",
    question: "你更想探索的边界，你更？",
    options: ["有点撩就够","越直白越上头","看气氛","行动大于语言"]
  },
  {
    difficulty: "BOLD",
    question: "大胆承认，你更？",
    options: ["心跳爆炸","反撩回去","假装嫌弃","直接亲上去"]
  },
  {
    difficulty: "BOLD",
    question: "你更吃哪种危险感，你更？",
    options: ["想被抱紧","想被亲久一点","想过夜","想确认专属关系"]
  },
  {
    difficulty: "BOLD",
    question: "亲密请求，你更？",
    options: ["交给对方","自己主导","轮流","默契就好"]
  },
  {
    difficulty: "BOLD",
    question: "你更想在哪被抱紧，你更？",
    options: ["半公开场合牵手","私密角色扮演","旅行陌生环境","都不想要"]
  },
  {
    difficulty: "BOLD",
    question: "对方突然说别动，你更？",
    options: ["偏要继续一点","立刻收手","问那其实想要吗","换温柔方式"]
  },
  {
    difficulty: "BOLD",
    question: "你更敢聊哪种话题，你更？",
    options: ["想抱抱","想接吻","想过夜聊天","想更进一步"]
  },
  {
    difficulty: "BOLD",
    question: "大胆后你更希望，你更？",
    options: ["直接说想你","故意卖关子","凑近耳语","说你想听的那种"]
  },
  {
    difficulty: "BOLD",
    question: "你更想听哪种欲望表达，你更？",
    options: ["唇","脖颈","额头","手心"]
  },
  {
    difficulty: "BOLD",
    question: "敢不敢说过夜，你更？",
    options: ["雨夜沙发","旅行酒店","清晨被窝","电影院角落"]
  },
  {
    difficulty: "BOLD",
    question: "你更喜欢的挑逗方式，你更？",
    options: ["我现在很想你","我想抱你","我想亲你","我想和你更近"]
  },
  {
    difficulty: "BOLD",
    question: "对方突然认真看你，你更？",
    options: ["偶尔开一点","只私下开","不喜欢","互相接梗更好"]
  },
  {
    difficulty: "BOLD",
    question: "你更想尝试的角色感，你更？",
    options: ["有点撩就够","越直白越上头","看气氛","行动大于语言"]
  },
  {
    difficulty: "BOLD",
    question: "尺度对话你更，你更？",
    options: ["心跳爆炸","反撩回去","假装嫌弃","直接亲上去"]
  },
  {
    difficulty: "BOLD",
    question: "你更怕哪种太快，你更？",
    options: ["想被抱紧","想被亲久一点","想过夜","想确认专属关系"]
  },
  {
    difficulty: "BOLD",
    question: "敢不敢承认幻想，你更？",
    options: ["交给对方","自己主导","轮流","默契就好"]
  },
  {
    difficulty: "BOLD",
    question: "你更想被怎样点名，你更？",
    options: ["半公开场合牵手","私密角色扮演","旅行陌生环境","都不想要"]
  },
  {
    difficulty: "BOLD",
    question: "大胆消息敢发到哪，你更？",
    options: ["偏要继续一点","立刻收手","问那其实想要吗","换温柔方式"]
  },
  {
    difficulty: "BOLD",
    question: "你更喜欢的私密夜晚，你更？",
    options: ["想抱抱","想接吻","想过夜聊天","想更进一步"]
  },
  {
    difficulty: "BOLD",
    question: "对方突然靠近耳边，你更？",
    options: ["直接说想你","故意卖关子","凑近耳语","说你想听的那种"]
  }
];
