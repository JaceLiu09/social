import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import avatarManifest from "./avatarManifest.json";

const ENV_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim();
const DEFAULT_API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:4000`;
const API = (ENV_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
const MALE_SYMBOL_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#46d5e6"/><stop offset="1" stop-color="#4f86ea"/></linearGradient></defs>
    <rect width="256" height="256" rx="128" fill="url(#g)"/>
    <text x="128" y="150" text-anchor="middle" font-size="120" font-family="Arial, Helvetica, sans-serif" fill="#fff">♂</text>
  </svg>`
)}`;
const settingItems = [
  "账户与安全",
  "消息通知",
  "隐私",
  "我的在线状态",
  "辅助功能",
  "消息故障诊断",
  "创作者中心",
  "达人荣誉",
  "安全中心",
  "社交礼仪分",
  "盲盒币充值"
];
const maleAvatarPool = (avatarManifest.male || []).map((src, idx) => ({
  src,
  gender: "MALE",
  alt: `男生头像${idx + 1}`
}));
const femaleAvatarPool = (avatarManifest.female || []).map((src, idx) => ({
  src,
  gender: "FEMALE",
  alt: `女生头像${idx + 1}`
}));
const localAvatarPool = [...maleAvatarPool, ...femaleAvatarPool];

function sampleItems(list, count) {
  return [...list]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

function createHeroAvatars() {
  return sampleItems(localAvatarPool, 5);
}

const SENTENCE_CHAIN_BANK = [
  {
    stem: "周末突然下雨，我会先",
    options: ["约你去咖啡馆躲雨", "在家看一部老电影", "去楼下便利店买热饮"]
  },
  {
    stem: "第一次见面最加分的是",
    options: ["说话真诚不端着", "穿着干净有细节", "会认真听我讲话"]
  },
  {
    stem: "一起旅行时我更在意",
    options: ["行程松弛不赶路", "拍照好看有仪式感", "吃到本地特色小店"]
  },
  {
    stem: "晚上聊天冷场时，我会",
    options: ["丢一个有趣的问题", "分享今天的小糗事", "发一张正在听的歌单"]
  },
  {
    stem: "关系升温最快的方式是",
    options: ["稳定且高质量联系", "一起完成一件小事", "情绪低落时彼此接住"]
  },
  {
    stem: "如果对方迟到十分钟，我会",
    options: ["先找个地方坐着等", "发消息确认是否堵车", "顺便买两杯饮料"]
  },
  {
    stem: "最理想的约会结尾是",
    options: ["散步到地铁口再告别", "互发今天最喜欢的瞬间", "约好下次见面的时间"]
  }
];

function createSentenceChainRounds(count = 5) {
  return sampleItems(SENTENCE_CHAIN_BANK, count).map((item, idx) => ({
    id: `sentence-round-${idx + 1}`,
    stem: item.stem,
    options: item.options
  }));
}

const TRUTH_ROUNDS_PER_GAME = 5;
const TRUTH_DIFFICULTY_OPTIONS = [
  { id: "LIGHT", label: "轻松" },
  { id: "HEART", label: "走心" },
  { id: "DEEP", label: "深度" },
  { id: "MIXED", label: "混合" }
];

function pickRandomItem(list, fallback = null) {
  if (!Array.isArray(list) || !list.length) return fallback;
  return list[Math.floor(Math.random() * list.length)] || fallback;
}

function getDiceFace(value) {
  const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const idx = Math.max(1, Math.min(6, Number(value) || 1)) - 1;
  return faces[idx];
}

function playDiceTone(audioContext, frequency, durationSec = 0.08, gainValue = 0.04) {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "triangle";
  osc.frequency.value = frequency;
  gain.gain.value = gainValue;
  osc.connect(gain);
  gain.connect(audioContext.destination);
  const now = audioContext.currentTime;
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
  osc.start(now);
  osc.stop(now + durationSec);
}

function createTruthChallengeBank() {
  const scenes = [
    "第一次见面",
    "深夜聊天",
    "异地相处",
    "争吵后和好",
    "周末约会",
    "节日仪式感",
    "朋友圈互动",
    "见家长前",
    "暧昧升温期",
    "认真交往后",
    "长期关系里",
    "压力很大时",
    "低落情绪里",
    "被误会之后",
    "被夸赞之后",
    "冷战阶段",
    "想确认关系时",
    "准备告白前",
    "想复合的时候",
    "想放弃的时候"
  ];
  const focuses = [
    "最在意对方哪一点",
    "最想被理解的部分",
    "最怕被踩中的底线",
    "最容易吃醋的瞬间",
    "最想一起完成的事",
    "最想立刻表达的话",
    "最不愿妥协的原则",
    "最期待得到的回应",
    "最想改变的习惯",
    "最想守住的承诺"
  ];
  const tonesByDifficulty = {
    LIGHT: ["幽默", "轻松", "自在"],
    HEART: ["温柔", "走心", "真诚"],
    DEEP: ["深聊", "理性", "直面"]
  };
  const answerOpenings = [
    "我会坦白说，",
    "如果认真回答，",
    "我内心最真实的是，",
    "站在现在的我看，",
    "我想先诚实一点，"
  ];
  const answerCores = [
    "希望彼此有稳定的安全感",
    "希望被看见情绪而不被否定",
    "希望在冲突里也能被尊重",
    "希望关系里有持续的行动",
    "希望两个人都愿意成长",
    "希望交流是坦诚且温和的",
    "希望日常陪伴比口号更真实",
    "希望在关键时刻互相托底",
    "希望被坚定选择而不是备选",
    "希望彼此能把话说开"
  ];
  const answerEndings = [
    "这会让我更有安全感。",
    "这样我才敢继续投入。",
    "这比任何甜言蜜语都重要。",
    "我会因此更确定这段关系。",
    "这就是我最看重的答案。"
  ];
  const bank = [];
  TRUTH_DIFFICULTY_OPTIONS.forEach((difficulty) => {
    scenes.forEach((scene) => {
      focuses.forEach((focus) => {
        (tonesByDifficulty[difficulty.id] || ["真诚"]).forEach((tone) => {
          const opening = pickRandomItem(answerOpenings, "我会坦白说，");
          const core = pickRandomItem(answerCores, "希望彼此真诚沟通");
          const ending = pickRandomItem(answerEndings, "这对我很重要。");
          bank.push({
            difficulty: difficulty.id,
            question: `【${difficulty.label}/${tone}】在${scene}里，你${focus}？`,
            answer: `${opening}${core}，${ending}`
          });
        });
      });
    });
  });
  return bank.slice(0, 1000);
}

const TRUTH_CHALLENGE_BANK = createTruthChallengeBank();

function formatChatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatBirthDateText(value) {
  if (!value) return "未设置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未设置";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveAssetUrl(url) {
  if (!url) return MALE_SYMBOL_AVATAR;
  if (url.startsWith("data:")) return url;
  const currentOrigin = `${window.location.protocol}//${window.location.host}`;
  if (url.startsWith("http://localhost:5173/avatars/") || url.startsWith("https://localhost:5173/avatars/")) {
    return url.replace(/^https?:\/\/localhost:5173/, currentOrigin);
  }
  if (url.startsWith("/avatars/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API}${url}`;
  return url;
}

function resolveMediaUrl(url) {
  if (!url) return "";
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/uploads/")) return `${API}${raw}`;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) return raw;
  return "";
}

/** 用户主展示图原始地址（不含 resolveAssetUrl），用于保存与聊天头像回退 */
function getUserPrimaryRawImageUrl(user) {
  if (!user) return "";
  if (user.avatarUrl) return String(user.avatarUrl).trim();
  try {
    const parsed = JSON.parse(user.photoUrls || "[]");
    if (Array.isArray(parsed) && parsed[0]) return String(parsed[0]).trim();
  } catch (_e) {
    /* ignore */
  }
  return "";
}

function toTenDigitId(input) {
  const raw = String(input || "");
  let hash = 0n;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 131n + BigInt(raw.charCodeAt(i))) % 10000000000n;
  }
  return hash.toString().padStart(10, "0");
}

const registerBasicInitial = {
  phone: "",
  password: "",
  smsCode: ""
};

const profileSetupInitial = {
  nickname: "",
  gender: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  hometown: "",
  currentCity: "",
  income: "",
  industry: "",
  hobbies: "",
  partnerExpectation: "",
  avatarUrl: ""
};

/** 路径与主导航 tab 同步（支持 /match 独立页刷新、分享） */
const ROUTE_TAB = {
  "/planet": "planet",
  "/square": "square",
  "/chat": "chat",
  "/me": "me",
  "/match": "planet-match"
};

const WEREWOLF_ROLE_CONFIG = {
  6: { wolf: 2, seer: 1, witch: 0, hunter: 1, idiot: 0, villager: 2 },
  7: { wolf: 2, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 2 },
  8: { wolf: 3, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 2 },
  9: { wolf: 3, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 3 },
  10: { wolf: 3, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 4 },
  11: { wolf: 4, seer: 1, witch: 1, hunter: 1, idiot: 0, villager: 4 },
  12: { wolf: 4, seer: 1, witch: 1, hunter: 1, idiot: 1, villager: 4 }
};

function buildWerewolfRulePack(playerCount, modeLabel) {
  const count = Math.max(6, Math.min(12, Number(playerCount) || 6));
  const role = WEREWOLF_ROLE_CONFIG[count] || WEREWOLF_ROLE_CONFIG[6];
  const baseRule = count <= 7
    ? "屠城（杀光好人 / 狼人），无警长"
    : "屠边（杀光神 / 民），有警长（1.5票）";
  return {
    count,
    modeLabel,
    role,
    baseRule,
    script: [
      "开局：游戏开始，请确认身份，全部闭眼。",
      "黑夜：狼人睁眼选击杀；预言家查验；女巫看死讯后可救/毒。",
      "天亮：公布死讯（首夜死有遗言、白天被推有遗言，其余无）。",
      count >= 8 ? "警长竞选：上警发言，未上警投票，警长1.5票可移交警徽。" : "本局无警长环节。",
      "白天发言：从指定号开始顺时针发言，不许插话。",
      "投票放逐：统计票型，出局玩家遗言。",
      "狼人可自爆：白天立刻结束，直接进入天黑。",
      "结束判定：好人胜利 / 狼人胜利。"
    ]
  };
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const tab = ROUTE_TAB[location.pathname] ?? "planet";

  useLayoutEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(ROUTE_TAB, location.pathname)) {
      navigate("/planet", { replace: true });
    }
  }, [location.pathname, navigate]);

  const [chatMode, setChatMode] = useState("chat");
  const [mePage, setMePage] = useState("home");
  const [meDetailPage, setMeDetailPage] = useState("");
  const [meHeaderAvatarFailed, setMeHeaderAvatarFailed] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [agreed, setAgreed] = useState(false);
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [session, setSession] = useState(null);
  const [blindBoxTarget, setBlindBoxTarget] = useState(null);
  const [onlineCount, setOnlineCount] = useState(200000);
  const [hiddenProfiles, setHiddenProfiles] = useState([]);
  const [heroRotationIndex, setHeroRotationIndex] = useState(0);
  const [posts, setPosts] = useState([]);
  const [squareLoading, setSquareLoading] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [pullHint, setPullHint] = useState("下拉刷新");
  const [squareOffset, setSquareOffset] = useState(0);
  const squareFeedRef = useRef(null);
  const socketRef = useRef(null);
  const activeConversationIdRef = useRef("");
  const touchStartYRef = useRef(0);
  const pullTriggeredRef = useRef(false);
  const [message, setMessage] = useState("");
  const [loginForm, setLoginForm] = useState({ account: "", password: "" });
  const [registerForm, setRegisterForm] = useState(registerBasicInitial);
  const [profileSetupForm, setProfileSetupForm] = useState(profileSetupInitial);
  const [profileSetupPhotos, setProfileSetupPhotos] = useState([]);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const registerPhoneRef = useRef(null);
  const registerPasswordRef = useRef(null);
  const [chatKeyword, setChatKeyword] = useState("");
  const [heroAvatarList] = useState(() => createHeroAvatars());
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatNotice, setChatNotice] = useState("");
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [addFriendKeyword, setAddFriendKeyword] = useState("");
  const [addFriendResults, setAddFriendResults] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);
  const [gameSfxEnabled, setGameSfxEnabled] = useState(true);
  const [showWerewolfModal, setShowWerewolfModal] = useState(false);
  const [werewolfMode, setWerewolfMode] = useState("menu");
  const [werewolfRoomMembers, setWerewolfRoomMembers] = useState([]);
  const [werewolfRoomId, setWerewolfRoomId] = useState("");
  const [werewolfRulePack, setWerewolfRulePack] = useState(null);
  const [werewolfInvitations, setWerewolfInvitations] = useState([]);
  const [showWerewolfInvitePanel, setShowWerewolfInvitePanel] = useState(false);
  const [werewolfInviteCooldowns, setWerewolfInviteCooldowns] = useState({});
  const [isWerewolfMatching, setIsWerewolfMatching] = useState(false);
  const [werewolfGame, setWerewolfGame] = useState(null);
  const [werewolfSpeechDraft, setWerewolfSpeechDraft] = useState("");
  const [werewolfActionLoading, setWerewolfActionLoading] = useState(false);
  const [werewolfSpeechCountdown, setWerewolfSpeechCountdown] = useState(0);
  const [werewolfIntroCountdown, setWerewolfIntroCountdown] = useState(0);
  const [werewolfFxText, setWerewolfFxText] = useState("");
  const [showTacitModal, setShowTacitModal] = useState(false);
  const [tacitMode, setTacitMode] = useState("menu");
  const [tacitRoomId, setTacitRoomId] = useState("");
  const [tacitRoom, setTacitRoom] = useState(null);
  const [tacitInvitations, setTacitInvitations] = useState([]);
  const [tacitDraftChoice, setTacitDraftChoice] = useState("");
  const [tacitConfirming, setTacitConfirming] = useState(false);
  const [tacitSubmittedQuestionId, setTacitSubmittedQuestionId] = useState("");
  const [tacitCountdownSec, setTacitCountdownSec] = useState(30);
  const [tacitIntroCountdown, setTacitIntroCountdown] = useState(0);
  const [tacitFxText, setTacitFxText] = useState("");
  const [showMembershipGate, setShowMembershipGate] = useState(false);
  const [membershipSubmitting, setMembershipSubmitting] = useState(false);
  const [membershipGateContext, setMembershipGateContext] = useState("invite");
  const [planetMatchLoading, setPlanetMatchLoading] = useState(false);
  const [planetMatchProfile, setPlanetMatchProfile] = useState(null);
  const [planetMatchWaitHint, setPlanetMatchWaitHint] = useState("");
  const [showSentenceModal, setShowSentenceModal] = useState(false);
  const [sentenceMode, setSentenceMode] = useState("menu");
  const [isSentenceMatching, setIsSentenceMatching] = useState(false);
  const [sentenceOpponent, setSentenceOpponent] = useState(null);
  const [sentenceRounds, setSentenceRounds] = useState([]);
  const [sentenceRoundIndex, setSentenceRoundIndex] = useState(0);
  const [sentenceMyChoice, setSentenceMyChoice] = useState("");
  const [sentencePeerChoice, setSentencePeerChoice] = useState("");
  const [sentenceCountdown, setSentenceCountdown] = useState(20);
  const [sentenceScore, setSentenceScore] = useState(0);
  const [sentenceLogs, setSentenceLogs] = useState([]);
  const [sentenceResolving, setSentenceResolving] = useState(false);
  const [sentenceIntroCountdown, setSentenceIntroCountdown] = useState(0);
  const [sentenceFxText, setSentenceFxText] = useState("");
  const [showTruthModal, setShowTruthModal] = useState(false);
  const [truthMode, setTruthMode] = useState("menu");
  const [isTruthMatching, setIsTruthMatching] = useState(false);
  const [truthDifficulty, setTruthDifficulty] = useState("LIGHT");
  const [truthOpponent, setTruthOpponent] = useState(null);
  const [truthDiceResult, setTruthDiceResult] = useState(null);
  const [truthRoundIndex, setTruthRoundIndex] = useState(0);
  const [truthAnswerDraft, setTruthAnswerDraft] = useState("");
  const [truthAwaitingMyAnswer, setTruthAwaitingMyAnswer] = useState(false);
  const [truthPhase, setTruthPhase] = useState("idle");
  const [truthPhaseCountdown, setTruthPhaseCountdown] = useState(0);
  const [truthQuestionOptions, setTruthQuestionOptions] = useState([]);
  const [truthPickedQuestionIndex, setTruthPickedQuestionIndex] = useState(-1);
  const [truthCurrentQuestion, setTruthCurrentQuestion] = useState("");
  const [truthCurrentDifficultyLabel, setTruthCurrentDifficultyLabel] = useState("轻松");
  const [truthRollingDice, setTruthRollingDice] = useState({ me: 1, peer: 1 });
  const [truthIsRolling, setTruthIsRolling] = useState(false);
  const [truthDiceSettling, setTruthDiceSettling] = useState(false);
  const [truthRoundAnimating, setTruthRoundAnimating] = useState(false);
  const [truthLogs, setTruthLogs] = useState([]);
  const [truthInviteMembers, setTruthInviteMembers] = useState([]);
  const [isTacitMatching, setIsTacitMatching] = useState(false);
  const [myPosts, setMyPosts] = useState([]);
  const [newPostText, setNewPostText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pinnedConversationIds, setPinnedConversationIds] = useState([]);
  const [hiddenConversationIds, setHiddenConversationIds] = useState([]);
  const [swipedConversationId, setSwipedConversationId] = useState("");
  const swipeStartXRef = useRef(0);
  const swipeActiveIdRef = useRef("");
  const hiddenConversationIdsRef = useRef([]);
  const [brokenImageIds, setBrokenImageIds] = useState([]);
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStartAtRef = useRef(0);
  const [selectedCover, setSelectedCover] = useState("");
  const [editProfilePhotos, setEditProfilePhotos] = useState([]);
  const [profileForm, setProfileForm] = useState({
    nickname: "",
    currentCity: "",
    hobbies: "",
    partnerExpectation: "",
    avatarUrl: ""
  });
  const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
  const AUDIO_MAX_BYTES = 8 * 1024 * 1024;
  const UPLOAD_TIMEOUT_MS = 20000;
  const werewolfPollingRef = useRef(null);
  const werewolfSyncRetryRef = useRef(0);
  const tacitPollingRef = useRef(null);
  const tacitAutoSubmitRef = useRef("");
  const sentenceMatchTimerRef = useRef(null);
  const sentenceResolveTimerRef = useRef(null);
  const truthMatchTimerRef = useRef(null);
  const truthRoundTimerRef = useRef(null);
  const truthDiceAnimRef = useRef(null);
  const truthRunRoundRef = useRef(null);
  const truthDiceSettleTimerRef = useRef(null);
  const truthPhaseTimerRef = useRef(null);
  const truthCountdownTimerRef = useRef(null);
  const truthAutoActionTimerRef = useRef(null);
  const truthRoundAnimTimerRef = useRef(null);
  const truthRoundContextRef = useRef(null);
  const audioContextRef = useRef(null);
  const planetMatchSfxIntervalRef = useRef(null);
  const planetMatchFlowLockRef = useRef(false);
  const planetMatchDismissedRef = useRef(false);
  const truthInviteTimersRef = useRef([]);
  const profilePhotoInputRef = useRef(null);

  const profilePhotos = useMemo(() => {
    if (!user?.photoUrls) return [];
    try {
      const parsed = JSON.parse(user.photoUrls);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }, [user]);
  const defaultCover = resolveAssetUrl(profileForm.avatarUrl || user?.avatarUrl || profilePhotos[0]);
  const profileCover = selectedCover || defaultCover;
  const userAvatar = resolveAssetUrl(profileForm.avatarUrl || user?.avatarUrl || profilePhotos[0]);
  const galleryPhotos = useMemo(() => {
    const list = [userAvatar, ...profilePhotos.slice(1)];
    const unique = [];
    list.forEach((item) => {
      if (item && !unique.includes(item)) unique.push(item);
    });
    return unique.slice(0, 3);
  }, [profilePhotos, userAvatar]);
  const filteredConversations = useMemo(
    () =>
      conversations.filter((item) => {
        const keyword = chatKeyword.trim();
        if (!keyword) return true;
        return item.name.includes(keyword) || item.preview.includes(keyword);
      }),
    [chatKeyword, conversations]
  );
  const filteredContacts = useMemo(
    () =>
      contacts.filter((item) => {
        const keyword = chatKeyword.trim();
        if (!keyword) return true;
        return item.name.includes(keyword) || item.status.includes(keyword);
      }),
    [chatKeyword, contacts]
  );
  const addFriendCandidates = useMemo(() => addFriendResults, [addFriendResults]);
  const invitedMemberCount = useMemo(
    () => Math.max(0, werewolfRoomMembers.filter((item) => item.id !== user?.id).length),
    [werewolfRoomMembers, user]
  );
  const acceptedMemberCount = useMemo(
    () => werewolfRoomMembers.filter((item) => item.accepted).length,
    [werewolfRoomMembers]
  );
  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unread || 0), 0),
    [conversations]
  );
  const currentWerewolfMember = useMemo(
    () => werewolfRoomMembers.find((item) => item.id === user?.id) || null,
    [werewolfRoomMembers, user]
  );
  const tacitAcceptedMembers = useMemo(
    () => (tacitRoom?.members || []).filter((m) => m.status === "HOST" || m.status === "ACCEPTED"),
    [tacitRoom]
  );
  const tacitCurrentQuestion = useMemo(
    () => (tacitRoom?.questions || []).find((q) => !q.done) || (tacitRoom?.questions || [])[0] || null,
    [tacitRoom]
  );
  const tacitMyChoice = useMemo(
    () => (user?.id && tacitCurrentQuestion?.choices ? tacitCurrentQuestion.choices[user.id] || "" : ""),
    [tacitCurrentQuestion, user]
  );
  const tacitDisplayChoice = tacitMyChoice || tacitDraftChoice;
  const tacitHasSubmitted = Boolean(tacitMyChoice) || tacitSubmittedQuestionId === tacitCurrentQuestion?.id;
  const tacitPeerMember = useMemo(
    () => tacitAcceptedMembers.find((m) => m.userId !== user?.id) || null,
    [tacitAcceptedMembers, user]
  );
  const tacitPeerDisplay = useMemo(() => {
    if (!tacitPeerMember) return null;
    const isMatchBot = tacitRoom?.type === "MATCH";
    if (!isMatchBot) {
      return {
        name: tacitPeerMember.name || "对方",
        avatar: tacitPeerMember.avatar || ""
      };
    }
    return {
      name: "你的隐藏款",
      avatar: tacitPeerMember.avatar || ""
    };
  }, [tacitPeerMember, tacitRoom?.type]);
  const authHeaders = useMemo(
    () =>
      authToken
        ? {
            Authorization: `Bearer ${authToken}`
          }
        : {},
    [authToken]
  );
  const visibleHiddenProfiles = useMemo(() => {
    if (!hiddenProfiles.length) return [];
    const base = hiddenProfiles.slice(0, 6);
    if (base.length <= 1) return base;
    const idx = heroRotationIndex % base.length;
    return [...base.slice(idx), ...base.slice(0, idx)];
  }, [hiddenProfiles, heroRotationIndex]);
  const truthBankByDifficulty = useMemo(() => {
    if (truthDifficulty === "MIXED") return TRUTH_CHALLENGE_BANK;
    const filtered = TRUTH_CHALLENGE_BANK.filter((item) => item.difficulty === truthDifficulty);
    return filtered.length ? filtered : TRUTH_CHALLENGE_BANK;
  }, [truthDifficulty]);
  const sentenceCurrentRound = sentenceRounds[sentenceRoundIndex] || null;
  const werewolfAliveCount = useMemo(
    () => (Array.isArray(werewolfGame?.players) ? werewolfGame.players.filter((p) => p.alive).length : 0),
    [werewolfGame]
  );
  const werewolfTotalCount = Array.isArray(werewolfGame?.players) ? werewolfGame.players.length : 0;
  const tacitProgressPercent = useMemo(() => {
    const idx = Number(tacitCurrentQuestion?.sortOrder || 0);
    const count = Number(tacitRoom?.questionCount || 10);
    const safe = Math.max(1, count);
    const done = tacitCurrentQuestion?.done ? idx + 1 : idx;
    return Math.max(0, Math.min(100, Math.round((done / safe) * 100)));
  }, [tacitCurrentQuestion, tacitRoom?.questionCount]);
  const sentenceProgressPercent = useMemo(() => {
    const total = Math.max(1, sentenceRounds.length || 5);
    const done = sentencePeerChoice ? sentenceRoundIndex + 1 : sentenceRoundIndex;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }, [sentencePeerChoice, sentenceRoundIndex, sentenceRounds.length]);
  const truthPhaseSteps = [
    { id: "rolling", label: "摇骰子" },
    { id: "pick", label: "选题" },
    { id: "answer", label: "作答" },
    { id: "review", label: "查看" }
  ];
  const truthPhaseIndex = Math.max(0, truthPhaseSteps.findIndex((item) => item.id === truthPhase));
  const truthAnswerMinLen = 3;
  const editPhotoSlots = useMemo(() => {
    const photos = editProfilePhotos.slice(0, 3).map((src, idx) => ({ type: "photo", src, idx }));
    const placeholders = [
      "最近吃过的美食",
      "独一无二的才艺",
      "我的有趣自拍",
      "我的生活日常",
      "最美好的纪念"
    ].map((label, idx) => ({ type: "placeholder", label, idx }));
    return [...photos, ...placeholders].slice(0, 6);
  }, [editProfilePhotos]);

  useEffect(() => {
    return () => {
      if (planetMatchSfxIntervalRef.current !== null) {
        clearInterval(planetMatchSfxIntervalRef.current);
        planetMatchSfxIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!tacitCurrentQuestion) {
      setTacitDraftChoice("");
      setTacitConfirming(false);
      setTacitSubmittedQuestionId("");
      setTacitCountdownSec(30);
      return;
    }
    if (tacitMyChoice) {
      setTacitDraftChoice(tacitMyChoice);
      setTacitConfirming(false);
      setTacitSubmittedQuestionId(tacitCurrentQuestion.id);
      setTacitCountdownSec(30);
      return;
    }
    setTacitDraftChoice("");
    setTacitConfirming(false);
    setTacitSubmittedQuestionId("");
    setTacitCountdownSec(30);
  }, [tacitCurrentQuestion?.id, tacitMyChoice]);

  useEffect(() => {
    tacitAutoSubmitRef.current = "";
  }, [tacitCurrentQuestion?.id]);

  useEffect(() => {
    if (!showTacitModal || tacitMode !== "playing" || !tacitRoomId) return undefined;
    const pullRoom = async () => {
      try {
        const res = await fetch(`${API}/tacit/rooms/${tacitRoomId}`, { headers: authHeaders });
        const data = await res.json();
        if (res.ok && data?.room) applyTacitRoom(data.room);
      } catch (_error) {}
    };
    pullRoom();
    const timer = window.setInterval(pullRoom, 1000);
    return () => clearInterval(timer);
  }, [showTacitModal, tacitMode, tacitRoomId, authHeaders]);

  useEffect(() => {
    // In normal gameplay we rely on socket push; polling is fallback only when game payload is missing.
    if (!showWerewolfModal || werewolfMode !== "playing" || werewolfGame) return undefined;
    werewolfSyncRetryRef.current = 0;
    const pullRoom = async () => {
      try {
        let nextRoom = null;
        if (werewolfRoomId) {
          const roomRes = await fetch(`${API}/werewolf/rooms/${werewolfRoomId}`, { headers: authHeaders });
          const roomData = await roomRes.json();
          if (roomRes.ok && roomData?.room) nextRoom = roomData.room;
        }
        if (!nextRoom) {
          const statusRes = await fetch(`${API}/werewolf/match/status`, { headers: authHeaders });
          const statusData = await statusRes.json();
          if (statusRes.ok && statusData?.matched && statusData?.room) nextRoom = statusData.room;
        }
        if (nextRoom) {
          applyWerewolfRoom(nextRoom);
          if (nextRoom.game) {
            werewolfSyncRetryRef.current = 0;
            return;
          }
        }
        werewolfSyncRetryRef.current += 1;
        if (werewolfSyncRetryRef.current >= 3) {
          setWerewolfRoomId("");
          setWerewolfRoomMembers([]);
          setWerewolfGame(null);
          setWerewolfMode("match");
          setIsWerewolfMatching(false);
          setChatNotice("房间状态失效，请点击“开始匹配”重新进入");
          werewolfSyncRetryRef.current = 0;
        }
      } catch (_error) {}
    };
    pullRoom();
    const timer = window.setInterval(pullRoom, 1500);
    return () => clearInterval(timer);
  }, [showWerewolfModal, werewolfMode, werewolfRoomId, werewolfGame, authHeaders]);

  useEffect(() => {
    if (!showWerewolfModal || werewolfMode !== "playing" || !werewolfGame || werewolfGame.phase !== "DAY_SPEECH" || werewolfGame.winner) {
      setWerewolfSpeechCountdown(0);
      return undefined;
    }
    const updateCountdown = () => {
      const deadlineAt = Number(werewolfGame.speechDeadlineAt || 0);
      if (deadlineAt > 0) {
        setWerewolfSpeechCountdown(Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000)));
      } else {
        setWerewolfSpeechCountdown(Math.max(0, Number(werewolfGame.speechSecondsLeft || 0)));
      }
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [showWerewolfModal, werewolfMode, werewolfGame]);

  useEffect(() => {
    if (!tacitCurrentQuestion || tacitMode !== "playing" || tacitIntroCountdown > 0) return undefined;
    if (tacitCountdownSec <= 0) {
      if (tacitAutoSubmitRef.current === tacitCurrentQuestion.id) return undefined;
      tacitAutoSubmitRef.current = tacitCurrentQuestion.id;
      if (!tacitHasSubmitted) {
        const autoChoice = tacitDraftChoice || (Math.random() > 0.5 ? "A" : "B");
        setTacitDraftChoice(autoChoice);
        setTacitSubmittedQuestionId(tacitCurrentQuestion.id);
        chooseTacitAnswer(autoChoice).catch(() => {
          setTacitSubmittedQuestionId("");
        });
      } else {
        fetch(`${API}/tacit/rooms/${tacitRoomId}`, { headers: authHeaders })
          .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
          .then(({ ok, data }) => {
            if (ok && data?.room) applyTacitRoom(data.room);
          })
          .catch(() => {});
      }
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setTacitCountdownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    tacitMode,
    tacitCurrentQuestion?.id,
    tacitHasSubmitted,
    tacitCountdownSec,
    tacitDraftChoice,
    tacitRoomId,
    authHeaders,
    tacitIntroCountdown
  ]);

  const sortConversations = (list, pinnedIds = pinnedConversationIds) =>
    [...list].sort((a, b) => {
      const pinA = pinnedIds.includes(a.id) ? 1 : 0;
      const pinB = pinnedIds.includes(b.id) ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      const timeA = new Date(a.time || 0).getTime() || 0;
      const timeB = new Date(b.time || 0).getTime() || 0;
      return timeB - timeA;
    });
  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.id || "";
  }, [activeConversation]);

  useEffect(() => {
    hiddenConversationIdsRef.current = hiddenConversationIds;
  }, [hiddenConversationIds]);

  useEffect(() => {
    if (!chatNotice) return undefined;
    const timer = setTimeout(() => setChatNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [chatNotice]);

  const refreshChatPanels = async (currentUserId) => {
    try {
      const [contactsRes, convRes] = await Promise.all([
        fetch(`${API}/chat/contacts?userId=${currentUserId}`, { headers: authHeaders }),
        fetch(`${API}/chat/conversations`, { headers: authHeaders })
      ]);
      const contactsData = await contactsRes.json();
      const convData = await convRes.json();
      if (!contactsRes.ok || !convRes.ok) {
        setContacts([]);
        setConversations([]);
        return;
      }
      setContacts(Array.isArray(contactsData.contacts) ? contactsData.contacts : []);
      const incoming = Array.isArray(convData.conversations) ? convData.conversations : [];
      const hiddenIds = hiddenConversationIdsRef.current;
      const visible = incoming.filter((item) => !hiddenIds.includes(item.id));
      setConversations(sortConversations(visible));
    } catch (_error) {
      // Keep last successful data if refresh fails briefly.
    }
  };

  const searchAddFriends = async (keyword = "") => {
    if (!String(keyword || "").trim()) {
      setAddFriendResults([]);
      return;
    }
    const res = await fetch(`${API}/friends/search?keyword=${encodeURIComponent(keyword)}`, {
      headers: authHeaders
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "搜索失败");
    setAddFriendResults(Array.isArray(data.users) ? data.users : []);
  };

  const onRunAddFriendSearch = async () => {
    try {
      await searchAddFriends(addFriendKeyword);
    } catch (error) {
      setChatNotice(error.message || "搜索失败");
    }
  };

  const loadIncomingRequests = async () => {
    const res = await fetch(`${API}/friends/requests/incoming`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "拉取好友请求失败");
    const list = Array.isArray(data.requests) ? data.requests : [];
    setIncomingRequests(list);
    setIncomingRequestCount(list.length);
  };

  const sendFriendRequest = async (toUserId, name) => {
    const res = await fetch(`${API}/friends/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ toUserId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "发起请求失败");
    await searchAddFriends(addFriendKeyword);
    setChatNotice(data.message || `已向 ${name} 发起加好友请求`);
  };

  const respondFriendRequest = async (requestId, action) => {
    const res = await fetch(`${API}/friends/requests/${requestId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "处理请求失败");
    await Promise.all([loadIncomingRequests(), searchAddFriends(addFriendKeyword), refreshChatPanels(user.id)]);
    setChatNotice(action === "ACCEPT" ? "已通过好友申请" : "已拒绝好友申请");
  };

  useEffect(() => {
    if (!authToken) return;
    loadIncomingRequests().catch(() => setIncomingRequestCount(0));
  }, [authToken]);

  useEffect(() => {
    if (!showAddFriendModal || !authToken) return undefined;
    loadIncomingRequests().catch(() => setIncomingRequestCount(0));
    const timer = setInterval(() => {
      loadIncomingRequests().catch(() => setIncomingRequestCount(0));
    }, 5000);
    return () => clearInterval(timer);
  }, [showAddFriendModal, authToken]);

  useEffect(() => {
    if (tab !== "chat" || !authToken) return undefined;
    const timer = setInterval(() => {
      loadIncomingRequests().catch(() => setIncomingRequestCount(0));
    }, 8000);
    return () => clearInterval(timer);
  }, [tab, authToken]);

  const refreshActiveMessages = async (_currentUserId, peerId) => {
    try {
      const res = await fetch(`${API}/chat/messages?peerId=${peerId}`, { headers: authHeaders });
      const data = await res.json();
      setChatMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (_error) {
      // Keep last loaded messages if refresh fails.
    }
  };

  const loadSquarePosts = async (reset = false) => {
    if (squareLoading) return;
    setSquareLoading(true);
    try {
      const targetOffset = reset ? 0 : squareOffset;
      const res = await fetch(
        `${API}/square/posts?limit=60&offset=${targetOffset}&refresh=${reset ? 1 : 0}`
      );
      const data = await res.json();
      const incoming = Array.isArray(data.posts) ? data.posts : [];

      if (reset) {
        setPosts(incoming);
        setSquareOffset(data.nextOffset || incoming.length);
        const nextHasMore =
          typeof data.hasMore === "boolean"
            ? data.hasMore
            : incoming.length > 0 && (data.total ? incoming.length < data.total : true);
        setHasMorePosts(nextHasMore);
      } else {
        setPosts((prev) => [...prev, ...incoming]);
        setSquareOffset(data.nextOffset || targetOffset + incoming.length);
        const nextHasMore =
          typeof data.hasMore === "boolean"
            ? data.hasMore
            : incoming.length > 0 && (data.total ? targetOffset + incoming.length < data.total : true);
        setHasMorePosts(nextHasMore);
      }
    } catch (_error) {
      if (reset) setPosts([]);
    } finally {
      setSquareLoading(false);
    }
  };

  useEffect(() => {
    loadSquarePosts(true);
  }, []);

  useEffect(() => {
    const pullCount = () => {
      fetch(`${API}/match/online-count`)
        .then((res) => res.json())
        .then((data) => setOnlineCount(data.count))
        .catch(() => null);
    };
    pullCount();
    const timer = setInterval(pullCount, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authToken) {
      setHiddenProfiles([]);
      return;
    }
    fetch(`${API}/planet/hidden-profiles`, { headers: authHeaders })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "加载隐藏款失败");
        setHiddenProfiles(Array.isArray(data.profiles) ? data.profiles : []);
        setHeroRotationIndex(0);
      })
      .catch(() => setHiddenProfiles([]));
  }, [authToken, authHeaders]);

  useEffect(() => {
    if (hiddenProfiles.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setHeroRotationIndex((prev) => (prev + 1) % Math.min(hiddenProfiles.length, 6));
    }, 5000);
    return () => clearInterval(timer);
  }, [hiddenProfiles]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("game-sfx-enabled");
      if (raw === null) return;
      setGameSfxEnabled(raw !== "0");
    } catch (_error) {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("game-sfx-enabled", gameSfxEnabled ? "1" : "0");
    } catch (_error) {}
  }, [gameSfxEnabled]);

  useEffect(() => {
    if (
      !showSentenceModal ||
      sentenceMode !== "playing" ||
      sentenceIntroCountdown > 0 ||
      sentenceMyChoice ||
      sentencePeerChoice ||
      sentenceResolving
    ) {
      return undefined;
    }
    if (sentenceCountdown <= 0) {
      if (!sentenceCurrentRound?.options?.length) return undefined;
      const autoChoice = sentenceCurrentRound.options[Math.floor(Math.random() * sentenceCurrentRound.options.length)];
      setSentenceMyChoice(autoChoice);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setSentenceCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    showSentenceModal,
    sentenceMode,
    sentenceCountdown,
    sentenceMyChoice,
    sentencePeerChoice,
    sentenceResolving,
    sentenceCurrentRound,
    sentenceIntroCountdown
  ]);

  useEffect(() => {
    if (
      !showSentenceModal ||
      sentenceMode !== "playing" ||
      sentenceIntroCountdown > 0 ||
      !sentenceMyChoice ||
      sentencePeerChoice ||
      sentenceResolving
    ) {
      return;
    }
    resolveSentenceRound(sentenceMyChoice);
  }, [showSentenceModal, sentenceMode, sentenceMyChoice, sentencePeerChoice, sentenceResolving, sentenceIntroCountdown]);

  useEffect(() => {
    if (!showWerewolfModal || werewolfMode !== "playing") return;
    setWerewolfIntroCountdown(3);
  }, [showWerewolfModal, werewolfMode, werewolfRoomId]);

  useEffect(() => {
    if (werewolfIntroCountdown <= 0) return undefined;
    if (werewolfIntroCountdown === 3) playGameSfx("countdown");
    const timer = window.setTimeout(() => setWerewolfIntroCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [werewolfIntroCountdown]);

  useEffect(() => {
    if (!showTacitModal || tacitMode !== "playing") return;
    setTacitIntroCountdown(3);
  }, [showTacitModal, tacitMode, tacitRoomId]);

  useEffect(() => {
    if (tacitIntroCountdown <= 0) return undefined;
    if (tacitIntroCountdown === 3) playGameSfx("countdown");
    const timer = window.setTimeout(() => setTacitIntroCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [tacitIntroCountdown]);

  useEffect(() => {
    if (!showSentenceModal || sentenceMode !== "playing") return;
    setSentenceIntroCountdown(3);
  }, [showSentenceModal, sentenceMode, sentenceOpponent?.id]);

  useEffect(() => {
    if (sentenceIntroCountdown <= 0) return undefined;
    if (sentenceIntroCountdown === 3) playGameSfx("countdown");
    const timer = window.setTimeout(() => setSentenceIntroCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [sentenceIntroCountdown]);

  useEffect(() => {
    if (!werewolfGame?.winner) return;
    playGameSfx("win");
    setWerewolfFxText(`${
      werewolfGame.winner === "WOLF" ? "狼人阵营" : "好人阵营"
    }胜利`);
    const timer = window.setTimeout(() => setWerewolfFxText(""), 1200);
    return () => clearTimeout(timer);
  }, [werewolfGame?.winner]);

  useEffect(() => {
    if (!tacitCurrentQuestion?.done) return;
    playGameSfx(tacitCurrentQuestion.matched ? "hit" : "miss");
    setTacitFxText(tacitCurrentQuestion.matched ? "默契+10" : "本题未命中");
    const timer = window.setTimeout(() => setTacitFxText(""), 1000);
    return () => clearTimeout(timer);
  }, [tacitCurrentQuestion?.id, tacitCurrentQuestion?.done, tacitCurrentQuestion?.matched]);

  useEffect(() => {
    if (!sentencePeerChoice || !sentenceMyChoice) return;
    playGameSfx(sentencePeerChoice === sentenceMyChoice ? "hit" : "miss");
    setSentenceFxText(sentencePeerChoice === sentenceMyChoice ? "命中 +20" : "本题未命中");
    const timer = window.setTimeout(() => setSentenceFxText(""), 1000);
    return () => clearTimeout(timer);
  }, [sentencePeerChoice, sentenceMyChoice]);

  useEffect(() => {
    if (tacitMode !== "playing" || tacitIntroCountdown > 0 || !tacitCurrentQuestion?.id) return;
    playGameSfx("round");
  }, [tacitMode, tacitCurrentQuestion?.id, tacitIntroCountdown]);

  useEffect(() => {
    if (sentenceMode !== "playing" || sentenceIntroCountdown > 0) return;
    if (!sentenceCurrentRound?.id) return;
    playGameSfx("round");
  }, [sentenceMode, sentenceCurrentRound?.id, sentenceIntroCountdown]);

  useEffect(() => {
    if (truthMode !== "playing" || truthRoundIndex <= 0) return;
    setTruthRoundAnimating(true);
    if (truthRoundAnimTimerRef.current) clearTimeout(truthRoundAnimTimerRef.current);
    truthRoundAnimTimerRef.current = window.setTimeout(() => {
      setTruthRoundAnimating(false);
    }, 360);
    return () => {
      if (truthRoundAnimTimerRef.current) {
        clearTimeout(truthRoundAnimTimerRef.current);
        truthRoundAnimTimerRef.current = null;
      }
    };
  }, [truthMode, truthRoundIndex]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      nickname: user.nickname || "",
      currentCity: user.currentCity || "",
      hobbies: user.hobbies || "",
      partnerExpectation: user.partnerExpectation || "",
      avatarUrl: user.avatarUrl || ""
    });
  }, [user]);

  useEffect(() => {
    setMeHeaderAvatarFailed(false);
  }, [user?.avatarUrl, user?.photoUrls]);

  useEffect(() => {
    if (!user?.id) return;
    const key = `my-posts:${user.id}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        setMyPosts([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setMyPosts(Array.isArray(parsed) ? parsed : []);
    } catch (_error) {
      setMyPosts([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      window.localStorage.setItem(`my-posts:${user.id}`, JSON.stringify(myPosts));
    } catch (_error) {}
  }, [user?.id, myPosts]);

  useEffect(() => {
    if (mePage !== "profile-edit") return;
    setEditProfilePhotos(galleryPhotos.slice(0, 3));
  }, [mePage, galleryPhotos]);

  useEffect(() => {
    setSelectedCover(defaultCover);
  }, [defaultCover]);

  useEffect(() => {
    if (tab !== "me") {
      setMePage("home");
      setMeDetailPage("");
    }
  }, [tab]);
  useEffect(() => {
    if (tab !== "chat") {
      setActiveConversation(null);
      setChatKeyword("");
      setChatMessages([]);
      setChatInput("");
    }
  }, [tab]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const socket = io(API, {
      transports: ["websocket"],
      query: { userId: user.id }
    });
    socketRef.current = socket;

    socket.on("chat:message", (message) => {
      if (!message?.fromUserId || !message?.toUserId) return;
      const uid = String(user.id);
      const fromId = String(message.fromUserId);
      const toId = String(message.toUserId);
      const peerId = fromId === uid ? toId : fromId;
      const isActive = peerId === activeConversationIdRef.current;
      setHiddenConversationIds((prev) => prev.filter((id) => id !== peerId));
      if (isActive) {
        setChatMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) return prev;
          return [...prev, message];
        });
        fetch(`${API}/chat/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ peerId })
        }).catch(() => null);
      }
      setConversations((prev) => {
        const exists = prev.some((item) => item.id === peerId);
        const nextUnread = fromId === uid || isActive ? 0 : 1;
        if (fromId !== uid && !isActive) {
          const peerName = prev.find((item) => item.id === peerId)?.name || "新朋友";
          setChatNotice(`${peerName} 发来新消息`);
        }
        const next = exists
          ? prev.map((item) =>
              item.id === peerId
                ? {
                    ...item,
                    preview: message.text,
                    time: message.createdAt,
                    unread: fromId === uid || isActive ? 0 : (item.unread || 0) + 1
                  }
                : item
            )
          : [
              {
                id: peerId,
                name: "新朋友",
                avatar: "https://picsum.photos/80/80?chat",
                preview: message.text,
                time: message.createdAt,
                unread: nextUnread
              },
              ...prev
            ];
        return sortConversations(next);
      });
    });

    socket.on("werewolf:room:update", (room) => {
      applyWerewolfRoom(room);
      if (room?.game) {
        setWerewolfMode("playing");
      } else if (room?.status === "IN_GAME") {
        const mode = room.type === "MATCH" ? "多人匹配" : "好友房";
        setWerewolfRulePack(buildWerewolfRulePack(room.acceptedCount || 6, mode));
        setWerewolfMode(room.type === "MATCH" ? "playing" : "judge");
      }
    });
    socket.on("werewolf:invite", (invite) => {
      if (invite?.ownerName) {
        setChatNotice(`${invite.ownerName} 邀请你加入狼人杀好友房`);
      }
      loadWerewolfInvitations().catch(() => null);
    });
    socket.on("tacit:room:update", (room) => {
      if (!room?.id) return;
      setTacitRoomId(room.id);
      setTacitRoom(room);
      if (room.status === "WAITING") setTacitMode("room");
      if (room.status === "IN_PROGRESS") setTacitMode("playing");
      if (room.status === "FINISHED") setTacitMode("result");
    });
    socket.on("tacit:invite", (invite) => {
      if (invite?.ownerName) setChatNotice(`${invite.ownerName} 邀请你加入二选一默契挑战`);
      loadTacitInvitations().catch(() => null);
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [authHeaders, user]);

  useEffect(() => {
    if (!user || tab !== "chat") return;
    refreshChatPanels(user.id);
  }, [tab, user]);

  useEffect(() => {
    if (!user || tab !== "chat") return undefined;
    const timer = setInterval(() => {
      refreshChatPanels(user.id);
    }, 3000);
    return () => clearInterval(timer);
  }, [tab, user]);

  useEffect(() => {
    if (!user || tab !== "chat" || !activeConversation) return undefined;
    refreshActiveMessages(user.id, activeConversation.id);
    const timer = setInterval(() => {
      refreshActiveMessages(user.id, activeConversation.id);
    }, 1500);
    return () => clearInterval(timer);
  }, [activeConversation, tab, user]);

  const chatDetailPeerAvatarSrc = useMemo(
    () => (activeConversation ? resolveAssetUrl(activeConversation.avatar) : ""),
    [activeConversation?.avatar, activeConversation?.id]
  );
  const chatDetailMyAvatarSrc = useMemo(
    () => resolveAssetUrl(getUserPrimaryRawImageUrl(user)),
    [user?.avatarUrl, user?.photoUrls]
  );

  useEffect(
    () => () => {
      if (werewolfPollingRef.current) {
        clearInterval(werewolfPollingRef.current);
        werewolfPollingRef.current = null;
      }
      if (tacitPollingRef.current) {
        clearInterval(tacitPollingRef.current);
        tacitPollingRef.current = null;
      }
      if (truthMatchTimerRef.current) {
        clearTimeout(truthMatchTimerRef.current);
        truthMatchTimerRef.current = null;
      }
      if (truthRoundTimerRef.current) {
        clearTimeout(truthRoundTimerRef.current);
        truthRoundTimerRef.current = null;
      }
      if (truthDiceAnimRef.current) {
        clearInterval(truthDiceAnimRef.current);
        truthDiceAnimRef.current = null;
      }
      if (truthDiceSettleTimerRef.current) {
        clearTimeout(truthDiceSettleTimerRef.current);
        truthDiceSettleTimerRef.current = null;
      }
      if (truthPhaseTimerRef.current) {
        clearTimeout(truthPhaseTimerRef.current);
        truthPhaseTimerRef.current = null;
      }
      if (truthCountdownTimerRef.current) {
        clearInterval(truthCountdownTimerRef.current);
        truthCountdownTimerRef.current = null;
      }
      if (truthAutoActionTimerRef.current) {
        clearTimeout(truthAutoActionTimerRef.current);
        truthAutoActionTimerRef.current = null;
      }
      if (truthRoundAnimTimerRef.current) {
        clearTimeout(truthRoundAnimTimerRef.current);
        truthRoundAnimTimerRef.current = null;
      }
      if (truthInviteTimersRef.current.length) {
        truthInviteTimersRef.current.forEach((timer) => clearTimeout(timer));
        truthInviteTimersRef.current = [];
      }
    },
    []
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setWerewolfInviteCooldowns((prev) => {
        const next = {};
        Object.entries(prev).forEach(([uid, expireAt]) => {
          if (Number(expireAt) > now) next[uid] = Number(expireAt);
        });
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isMembershipValid = useMemo(() => {
    if (!user?.membershipExpireAt || user.membershipType === "FREE") return false;
    return new Date(user.membershipExpireAt) > new Date();
  }, [user]);

  const membershipGateCopy =
    membershipGateContext === "planet" || membershipGateContext === "truth"
      ? {
          title: "开通会员解锁资料与联系",
          desc: "查看详细资料、联系对方等功能需先开通会员。",
          cancel: "先看看"
        }
      : {
          title: "开通会员后可邀请再来一局",
          desc: "当前账号是免费用户，开通会员后可邀请对方继续下一局并添加好友。",
          cancel: "先不添加"
        };

  const mustAgree = () => {
    if (agreed) return true;
    setMessage("请先同意用户协议和隐私政策");
    return false;
  };

  const canSubmitLogin =
    agreed && loginForm.account.trim().length > 0 && loginForm.password.trim().length > 0;
  const canSubmitRegisterBasic =
    agreed &&
    (registerForm.phone.trim().length > 0 || (registerPhoneRef.current?.value || "").trim().length > 0) &&
    (registerForm.password.trim().length >= 6 || (registerPasswordRef.current?.value || "").trim().length >= 6) &&
    registerForm.smsCode.trim().length === 6;

  useEffect(() => {
    if (registerForm.smsCode.trim().length === 6) return;
    setAgreed(false);
  }, [registerForm.smsCode]);

  useEffect(() => {
    if (authMode !== "register") return undefined;
    const timer = setInterval(() => {
      const phoneVal = String(registerPhoneRef.current?.value || "");
      const passwordVal = String(registerPasswordRef.current?.value || "");
      setRegisterForm((prev) => {
        const nextPhone = prev.phone || phoneVal;
        const nextPassword = prev.password || passwordVal;
        if (nextPhone === prev.phone && nextPassword === prev.password) return prev;
        return { ...prev, phone: nextPhone, password: nextPassword };
      });
    }, 250);
    return () => clearInterval(timer);
  }, [authMode]);

  const onLogin = async (e) => {
    e.preventDefault();
    if (!mustAgree()) return;
    setMessage("");
    const payload = {
      phone: loginForm.account.trim(),
      password: loginForm.password
    };
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.message || "登录失败");
    setContacts([]);
    setConversations([]);
    setChatMessages([]);
    setActiveConversation(null);
    setChatInput("");
    setHiddenConversationIds([]);
    setUser(data.user);
    setAuthToken(data.token || "");
    setNeedsProfileSetup(Boolean(data.needsProfile || !data.user.profileCompleted));
    setProfileSetupForm(profileSetupInitial);
    setProfileSetupPhotos(data.user?.avatarUrl ? [data.user.avatarUrl] : []);
    setMessage(data.needsProfile || !data.user.profileCompleted ? "登录成功，请先完善资料" : "");
  };

  const onRegister = async (e) => {
    e.preventDefault();
    if (!mustAgree()) return;
    setMessage("");
    const payload = { ...registerForm };
    const res = await fetch(`${API}/auth/register-basic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409) {
        setAuthMode("login");
        setLoginForm({ account: registerForm.phone, password: registerForm.password });
        setMessage("手机号已注册，已切换到登录，点击登录即可进入");
        return;
      }
      setMessage(data.message || "注册失败");
      if (data.message) window.alert(data.message);
      return;
    }
    setContacts([]);
    setConversations([]);
    setChatMessages([]);
    setActiveConversation(null);
    setChatInput("");
    setHiddenConversationIds([]);
    setUser(data.user);
    setAuthToken(data.token || "");
    setNeedsProfileSetup(true);
    setProfileSetupForm(profileSetupInitial);
    setProfileSetupPhotos([]);
    setMessage("短信验证通过，注册成功，请完善资料");
  };

  const onCompleteProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    const { birthYear, birthMonth, birthDay, gender } = profileSetupForm;
    if (profileSetupPhotos.length < 1) {
      return setMessage("请至少上传1张新用户相册照片");
    }
    if (!gender) return setMessage("请选择性别");
    if (!birthYear || !birthMonth || !birthDay) {
      return setMessage("请选择完整的出生年月日");
    }
    const birthDate = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;
    const res = await fetch(`${API}/auth/complete-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        ...profileSetupForm,
        avatarUrl: profileSetupPhotos[0] || profileSetupForm.avatarUrl || "",
        birthDate
      })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.message || "资料提交失败");
    setUser(data.user);
    setNeedsProfileSetup(false);
    setProfileSetupPhotos([]);
    setMessage("");
  };

  const onPickSetupPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      const mediaUrl = await uploadMedia(compressed, "IMAGE");
      setProfileSetupPhotos((prev) => [mediaUrl, ...prev.filter((item) => item !== mediaUrl)].slice(0, 6));
      setProfileSetupForm((prev) => ({ ...prev, avatarUrl: mediaUrl }));
    } catch (error) {
      setMessage(error.message || "新用户相册上传失败");
    }
  };

  const quickLogin = async (type) => {
    if (!mustAgree()) return;
    const payload =
      type === "device"
        ? { phone: "13800000002", password: "123456" }
        : { phone: "13800000001", password: "123456" };
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return setMessage("快捷登录失败，请先注册账号");
    setContacts([]);
    setConversations([]);
    setChatMessages([]);
    setActiveConversation(null);
    setChatInput("");
    setHiddenConversationIds([]);
    setUser(data.user);
    setAuthToken(data.token || "");
    setNeedsProfileSetup(Boolean(data.needsProfile || !data.user.profileCompleted));
    setProfileSetupPhotos(data.user?.avatarUrl ? [data.user.avatarUrl] : []);
    setMessage(type === "device" ? "本机号码登录成功" : "微信快捷登录成功");
  };

  const leavePlanetMatchPage = () => {
    planetMatchDismissedRef.current = true;
    stopPlanetMatchSearchSfx();
    setPlanetMatchWaitHint("");
    setPlanetMatchProfile(null);
    setPlanetMatchLoading(false);
    navigate("/planet");
  };

  const startPlanetMatchFlow = async () => {
    if (!user) {
      setMessage("请先登录后再开始寻找");
      return;
    }
    if (planetMatchFlowLockRef.current) return;
    planetMatchFlowLockRef.current = true;
    planetMatchDismissedRef.current = false;

    let countdownIntervalId = null;
    try {
      try {
        flushSync(() => {
          setMessage("");
          navigate("/match");
          setPlanetMatchLoading(true);
          setPlanetMatchProfile(null);
        });
      } catch {
        setMessage("");
        navigate("/match");
        setPlanetMatchLoading(true);
        setPlanetMatchProfile(null);
      }

      const minWaitMs = Math.round(3000 + Math.random() * 4000);
      try {
        playPlanetMatchSearchSfx();
      } catch (_e) {
        /* 音效失败不影响匹配流程 */
      }

      const matchEndAt = Date.now() + minWaitMs;
      const refreshPlanetMatchCountdown = () => {
        const secLeft = Math.max(0, Math.ceil((matchEndAt - Date.now()) / 1000));
        setPlanetMatchWaitHint(
          secLeft > 0 ? `附近雷达扫描中，约 ${secLeft} 秒` : "正在连接匹配服务…"
        );
      };
      refreshPlanetMatchCountdown();
      countdownIntervalId = window.setInterval(refreshPlanetMatchCountdown, 250);

      /* 先完整跑完随机动画时长，再请求接口，避免并行/静默匹配路径在任何环境下被“秒完成” */
      await new Promise((resolve) => {
        window.setTimeout(resolve, minWaitMs);
      });

      const res = await fetch(`${API}/match/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "匹配失败");
      if (planetMatchDismissedRef.current) return;
      playPlanetMatchFoundSfx();
      setSession(data.session);
      setBlindBoxTarget(data.targetBlindBox);
      setMessage("匹配成功");
      const matchedId = data?.targetBlindBox?.id || "";
      const pool = hiddenProfiles.length ? hiddenProfiles : [];
      const picked =
        pool.find((item) => item.id === matchedId) ||
        (pool.length ? pool[Math.floor(Math.random() * pool.length)] : null);
      setPlanetMatchProfile(picked);
      if (!picked) setChatNotice("已匹配成功，可继续点击“开始寻找”刷新匹配对象");
    } catch (error) {
      stopPlanetMatchSearchSfx();
      if (!planetMatchDismissedRef.current) {
        setChatNotice(error.message || "匹配失败，请稍后再试");
        navigate("/planet");
      }
    } finally {
      if (countdownIntervalId !== null) window.clearInterval(countdownIntervalId);
      setPlanetMatchWaitHint("");
      setPlanetMatchLoading(false);
      planetMatchFlowLockRef.current = false;
    }
  };

  const handlePlanetDetailGate = () => {
    setMembershipGateContext("planet");
    setShowMembershipGate(true);
  };

  const handlePlanetContact = () => {
    if (!planetMatchProfile?.id) return;
    setMembershipGateContext("planet");
    setShowMembershipGate(true);
  };

  const onSquareScroll = async () => {
    const feed = squareFeedRef.current;
    if (!feed || squareLoading || !hasMorePosts) return;
    const nearBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 120;
    if (nearBottom) {
      await loadSquarePosts(false);
    }
  };

  const onSquareTouchStart = (e) => {
    const feed = squareFeedRef.current;
    if (!feed) return;
    touchStartYRef.current = e.touches[0].clientY;
    pullTriggeredRef.current = false;
  };

  const onSquareTouchMove = (e) => {
    const feed = squareFeedRef.current;
    if (!feed || feed.scrollTop > 0) return;
    const delta = e.touches[0].clientY - touchStartYRef.current;
    if (delta > 70) {
      setPullHint("松手刷新");
      pullTriggeredRef.current = true;
    } else if (delta > 10) {
      setPullHint("下拉刷新");
    }
  };

  const onSquareTouchEnd = async () => {
    if (pullTriggeredRef.current) {
      setPullHint("刷新中...");
      await loadSquarePosts(true);
      setPullHint("下拉刷新");
    }
  };

  const saveProfile = async () => {
    if (!user || !authToken) return;
    const fallbackRaw = profileForm.avatarUrl || getUserPrimaryRawImageUrl(user);
    const finalPhotos = editProfilePhotos.length ? editProfilePhotos : (fallbackRaw ? [fallbackRaw] : []);
    const finalAvatar = (profileForm.avatarUrl || finalPhotos[0] || getUserPrimaryRawImageUrl(user) || "").trim();
    try {
      const res = await fetch(`${API}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          nickname: profileForm.nickname,
          avatarUrl: finalAvatar || null,
          photoUrls: JSON.stringify(finalPhotos.slice(0, 3)),
          currentCity: profileForm.currentCity,
          hobbies: profileForm.hobbies,
          partnerExpectation: profileForm.partnerExpectation
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "保存失败");
      setUser(data.user);
      setMePage("home");
      setMessage("资料已更新");
    } catch (error) {
      setMessage(error.message || "保存失败，请稍后重试");
    }
  };

  const switchAccount = () => {
    setUser(null);
    setAuthToken("");
    setNeedsProfileSetup(false);
    setProfileSetupForm(profileSetupInitial);
    setProfileSetupPhotos([]);
    setSession(null);
    setBlindBoxTarget(null);
    setActiveConversation(null);
    setChatMessages([]);
    setChatInput("");
    setChatKeyword("");
    setMyPosts([]);
    setNewPostText("");
    setMePage("home");
    setMeDetailPage("");
    setAuthMode("login");
    setMessage("请切换账号登录");
  };

  const logout = () => {
    setUser(null);
    setAuthToken("");
    setNeedsProfileSetup(false);
    setProfileSetupForm(profileSetupInitial);
    setProfileSetupPhotos([]);
    setSession(null);
    setBlindBoxTarget(null);
    setActiveConversation(null);
    setChatMessages([]);
    setChatInput("");
    setChatKeyword("");
    setMyPosts([]);
    setNewPostText("");
    setMePage("home");
    setMeDetailPage("");
    setAuthMode("login");
    setMessage("已退出登录");
  };

  const openConversation = async (item) => {
    if (!user) return;
    setSwipedConversationId("");
    setActiveConversation(item);
    setChatInput("");
    await refreshActiveMessages(user.id, item.id);
    setConversations((prev) =>
      prev.map((conv) => (conv.id === item.id ? { ...conv, unread: 0 } : conv))
    );
    fetch(`${API}/chat/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ peerId: item.id })
    }).catch(() => null);
  };

  const uploadMedia = async (file, kind) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    try {
      const res = await fetch(`${API}/chat/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fileName: file.name,
          dataUrl,
          kind
        }),
        signal: controller.signal
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "上传失败");
      return data.url;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("上传超时，请检查网络后重试");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const compressImageFile = async (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("读取图片失败"));
      img.onload = async () => {
        const maxEdge = 1600;
        const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const targetW = Math.max(1, Math.round(img.width * ratio));
        const targetH = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, targetW, targetH);
        let quality = 0.85;
        let blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
        while (blob && blob.size > IMAGE_MAX_BYTES && quality > 0.45) {
          quality -= 0.1;
          blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
        }
        if (!blob) return reject(new Error("图片压缩失败"));
        if (blob.size > IMAGE_MAX_BYTES) {
          return reject(new Error("图片过大，请选择更小的图片"));
        }
        resolve(new File([blob], `img-${Date.now()}.jpg`, { type: "image/jpeg" }));
      };
      img.onerror = () => reject(new Error("图片解析失败"));
      reader.readAsDataURL(file);
    });

  const appendOwnMessage = (message) => {
    setChatMessages((prev) => [...prev, message]);
    setConversations((prev) =>
      sortConversations(
        prev.map((item) =>
          item.id === activeConversation.id
            ? {
                ...item,
                preview:
                  message.kind === "IMAGE"
                    ? "[图片]"
                    : message.kind === "AUDIO"
                      ? "[语音]"
                      : message.text,
                time: message.createdAt
              }
            : item
        )
      )
    );
  };

  const sendChatPayload = async (payload) => {
    if (!user || !activeConversation) return;
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("chat:send", {
        toUserId: activeConversation.id,
        ...payload
      });
      if (payload.kind === "TEXT") setChatInput("");
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(`${API}/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          toUserId: activeConversation.id,
          ...payload
        }),
        signal: controller.signal
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "发送失败");
      appendOwnMessage(data.message);
      if (payload.kind === "TEXT") setChatInput("");
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("发送超时，请稍后重试");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const sendChatMessage = async () => {
    if (!user || !activeConversation) return;
    const text = chatInput.trim();
    if (!text) return;
    try {
      await sendChatPayload({ kind: "TEXT", text });
    } catch (error) {
      setMessage(error.message || "发送失败，请稍后重试");
    }
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeConversation) return;
    try {
      const compressed = await compressImageFile(file);
      const mediaUrl = await uploadMedia(compressed, "IMAGE");
      await sendChatPayload({ kind: "IMAGE", mediaUrl });
    } catch (error) {
      setMessage(error.message || "图片发送失败");
    }
  };

  const onPickProfileAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      const mediaUrl = await uploadMedia(compressed, "IMAGE");
      setProfileForm((prev) => ({ ...prev, avatarUrl: mediaUrl }));
      setEditProfilePhotos((prev) => {
        const deduped = [mediaUrl, ...prev.filter((item) => item !== mediaUrl)];
        return deduped.slice(0, 3);
      });
    } catch (error) {
      setMessage(error.message || "头像上传失败");
    }
  };

  const toggleRecord = async () => {
    if (!activeConversation) return;
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordChunksRef.current = [];
      recordStartAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const durationSec = Math.max(1, Math.round((Date.now() - recordStartAtRef.current) / 1000));
        if (blob.size > AUDIO_MAX_BYTES) {
          setMessage("语音过长，请控制在 8MB 内");
          return;
        }
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: blob.type || "audio/webm"
        });
        try {
          const mediaUrl = await uploadMedia(file, "AUDIO");
          await sendChatPayload({ kind: "AUDIO", mediaUrl, audioDurationSec: durationSec });
        } catch (error) {
          setMessage(error.message || "语音发送失败");
        }
      };
      recorder.start();
      setIsRecording(true);
    } catch (_error) {
      setMessage("无法启用麦克风，请检查浏览器权限");
    }
  };

  const onConversationTouchStart = (e, conversationId) => {
    swipeStartXRef.current = e.touches[0].clientX;
    swipeActiveIdRef.current = conversationId;
    if (swipedConversationId && swipedConversationId !== conversationId) {
      setSwipedConversationId("");
    }
  };

  const onConversationTouchEnd = (e, conversationId) => {
    const delta = e.changedTouches[0].clientX - swipeStartXRef.current;
    if (delta < -40) {
      setSwipedConversationId(conversationId);
    } else if (delta > 30) {
      setSwipedConversationId("");
    }
    swipeActiveIdRef.current = "";
  };

  const onConversationMouseDown = (e, conversationId) => {
    swipeStartXRef.current = e.clientX;
    swipeActiveIdRef.current = conversationId;
    if (swipedConversationId && swipedConversationId !== conversationId) {
      setSwipedConversationId("");
    }
  };

  const onConversationMouseUp = (e, conversationId) => {
    if (swipeActiveIdRef.current !== conversationId) return;
    const delta = e.clientX - swipeStartXRef.current;
    if (delta < -40) {
      setSwipedConversationId(conversationId);
    } else if (delta > 30) {
      setSwipedConversationId("");
    }
    swipeActiveIdRef.current = "";
  };

  const onPinConversation = (conversationId) => {
    setPinnedConversationIds((prev) =>
      prev.includes(conversationId) ? prev.filter((id) => id !== conversationId) : [...prev, conversationId]
    );
    setConversations((prev) => sortConversations(prev));
    setSwipedConversationId("");
  };

  const onDeleteConversation = (conversationId) => {
    setHiddenConversationIds((prev) => [...new Set([...prev, conversationId])]);
    setPinnedConversationIds((prev) => prev.filter((id) => id !== conversationId));
    setConversations((prev) => prev.filter((item) => item.id !== conversationId));
    if (activeConversation?.id === conversationId) {
      setActiveConversation(null);
      setChatMessages([]);
    }
    setSwipedConversationId("");
  };

  const onBatchCleanConversations = () => {
    const allIds = conversations.map((item) => item.id);
    if (!allIds.length) return;
    setHiddenConversationIds((prev) => [...new Set([...prev, ...allIds])]);
    setPinnedConversationIds([]);
    setConversations([]);
    setActiveConversation(null);
    setChatMessages([]);
    setSwipedConversationId("");
    setMessage("已批量清理聊天记录");
  };

  const openWerewolfMenu = () => {
    setWerewolfRoomMembers([]);
    setWerewolfRoomId("");
    setWerewolfRulePack(null);
    setWerewolfMode("menu");
    setShowWerewolfModal(true);
    loadWerewolfInvitations().catch(() => setWerewolfInvitations([]));
  };

  const openTacitMenu = () => {
    setTacitMode("menu");
    setTacitRoom(null);
    setTacitRoomId("");
    setShowTacitModal(true);
    loadTacitInvitations().catch(() => setTacitInvitations([]));
  };

  const resetSentenceState = () => {
    setSentenceMode("menu");
    setIsSentenceMatching(false);
    setSentenceOpponent(null);
    setSentenceRounds([]);
    setSentenceRoundIndex(0);
    setSentenceMyChoice("");
    setSentencePeerChoice("");
    setSentenceCountdown(20);
    setSentenceScore(0);
    setSentenceLogs([]);
    setSentenceResolving(false);
    if (sentenceMatchTimerRef.current) {
      clearTimeout(sentenceMatchTimerRef.current);
      sentenceMatchTimerRef.current = null;
    }
    if (sentenceResolveTimerRef.current) {
      clearTimeout(sentenceResolveTimerRef.current);
      sentenceResolveTimerRef.current = null;
    }
  };

  const openSentenceMenu = () => {
    resetSentenceState();
    setShowSentenceModal(true);
  };

  const startSentenceGame = (opponent) => {
    const rounds = createSentenceChainRounds(5);
    setSentenceOpponent(opponent);
    setSentenceRounds(rounds);
    setSentenceRoundIndex(0);
    setSentenceMyChoice("");
    setSentencePeerChoice("");
    setSentenceCountdown(20);
    setSentenceScore(0);
    setSentenceLogs([]);
    setSentenceResolving(false);
    setSentenceMode("playing");
  };

  const startSentenceMatch = () => {
    if (isSentenceMatching) return;
    setSentenceMode("match");
    setIsSentenceMatching(true);
    if (sentenceMatchTimerRef.current) clearTimeout(sentenceMatchTimerRef.current);
    sentenceMatchTimerRef.current = window.setTimeout(() => {
      const source = hiddenProfiles.length
        ? hiddenProfiles
        : [{ id: "fallback-bot", nickname: "隐藏款", age: 24, city: "同城", hobbies: "电影,音乐", avatar: "", gender: "FEMALE" }];
      const target = source[Math.floor(Math.random() * source.length)];
      setIsSentenceMatching(false);
      startSentenceGame({
        id: target.id,
        name: target.nickname || "隐藏款",
        avatar: target.avatar || "",
        city: target.city || "同城",
        isBot: true
      });
    }, 1600);
  };

  const startSentenceInviteGame = (friend) => {
    startSentenceGame({
      id: friend.id,
      name: friend.name,
      avatar: friend.avatar || "",
      city: friend.status || "在线",
      isBot: false
    });
  };

  const resolveSentenceRound = (myChoice) => {
    if (!sentenceCurrentRound || sentenceResolving || sentencePeerChoice) return;
    setSentenceResolving(true);
    const options = sentenceCurrentRound.options || [];
    const delayMs = sentenceOpponent?.isBot ? 1200 + Math.floor(Math.random() * 1600) : 1600;
    if (sentenceResolveTimerRef.current) clearTimeout(sentenceResolveTimerRef.current);
    sentenceResolveTimerRef.current = window.setTimeout(() => {
      const randomFallback = options[Math.floor(Math.random() * options.length)] || "";
      const peerChoice =
        Math.random() < (sentenceOpponent?.isBot ? 0.55 : 0.5)
          ? myChoice
          : randomFallback === myChoice && options.length > 1
            ? options.find((item) => item !== myChoice) || randomFallback
            : randomFallback;
      setSentencePeerChoice(peerChoice);
      const matched = peerChoice === myChoice;
      setSentenceScore((prev) => prev + (matched ? 20 : 0));
      setSentenceLogs((prev) => [
        ...prev,
        `第 ${sentenceRoundIndex + 1} 题：你选「${myChoice}」，对方选「${peerChoice}」${matched ? "，默契+20" : "，继续加油"}。`
      ]);
      if (sentenceRoundIndex >= sentenceRounds.length - 1) {
        setSentenceMode("result");
        setSentenceResolving(false);
        return;
      }
      if (sentenceResolveTimerRef.current) clearTimeout(sentenceResolveTimerRef.current);
      sentenceResolveTimerRef.current = window.setTimeout(() => {
        setSentenceRoundIndex((prev) => prev + 1);
        setSentenceMyChoice("");
        setSentencePeerChoice("");
        setSentenceCountdown(20);
        setSentenceResolving(false);
      }, 1200);
    }, delayMs);
  };

  const pickSentenceChoice = (choice) => {
    if (!sentenceCurrentRound || sentenceMyChoice || sentencePeerChoice || sentenceResolving) return;
    setSentenceMyChoice(choice);
    resolveSentenceRound(choice);
  };

  const closeSentenceModal = () => {
    setShowSentenceModal(false);
    resetSentenceState();
  };

  const playGameSfx = (type) => {
    if (!gameSfxEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioContextRef.current) audioContextRef.current = new Ctx();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      if (type === "countdown") {
        playDiceTone(ctx, 740, 0.04, 0.02);
        window.setTimeout(() => playDiceTone(ctx, 880, 0.04, 0.02), 55);
        return;
      }
      if (type === "hit") {
        playDiceTone(ctx, 620, 0.06, 0.03);
        window.setTimeout(() => playDiceTone(ctx, 760, 0.06, 0.03), 65);
        return;
      }
      if (type === "miss") {
        playDiceTone(ctx, 320, 0.07, 0.025);
        return;
      }
      if (type === "win") {
        playDiceTone(ctx, 520, 0.06, 0.03);
        window.setTimeout(() => playDiceTone(ctx, 680, 0.08, 0.03), 70);
        window.setTimeout(() => playDiceTone(ctx, 860, 0.1, 0.028), 150);
        return;
      }
      if (type === "round") {
        playDiceTone(ctx, 480, 0.045, 0.02);
      }
    } catch (_error) {}
  };

  const stopPlanetMatchSearchSfx = () => {
    if (planetMatchSfxIntervalRef.current !== null) {
      clearInterval(planetMatchSfxIntervalRef.current);
      planetMatchSfxIntervalRef.current = null;
    }
  };

  const playPlanetMatchSearchSfx = () => {
    stopPlanetMatchSearchSfx();
    if (!gameSfxEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioContextRef.current) audioContextRef.current = new Ctx();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      let tick = 0;
      planetMatchSfxIntervalRef.current = window.setInterval(() => {
        if (!gameSfxEnabled) {
          stopPlanetMatchSearchSfx();
          return;
        }
        const base = 360 + (tick % 6) * 52;
        tick += 1;
        playDiceTone(ctx, base, 0.055, 0.02);
      }, 380);
    } catch (_error) {}
  };

  const playPlanetMatchFoundSfx = () => {
    stopPlanetMatchSearchSfx();
    playGameSfx("win");
  };

  const playTruthDiceSound = (type) => {
    if (!gameSfxEnabled) return;
    if (type === "roll") {
      playGameSfx("round");
      playGameSfx("countdown");
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioContextRef.current) audioContextRef.current = new Ctx();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      playDiceTone(ctx, 280, 0.08, 0.045);
      window.setTimeout(() => playDiceTone(ctx, 220, 0.1, 0.04), 75);
    } catch (_error) {}
  };

  const toggleGameSfx = () => {
    setGameSfxEnabled((prev) => !prev);
  };

  const resetTruthState = () => {
    setTruthMode("menu");
    setIsTruthMatching(false);
    setTruthOpponent(null);
    setTruthDiceResult(null);
    setTruthRoundIndex(0);
    setTruthAnswerDraft("");
    setTruthAwaitingMyAnswer(false);
    setTruthPhase("idle");
    setTruthPhaseCountdown(0);
    setTruthQuestionOptions([]);
    setTruthPickedQuestionIndex(-1);
    setTruthCurrentQuestion("");
    setTruthCurrentDifficultyLabel("轻松");
    setTruthRollingDice({ me: 1, peer: 1 });
    setTruthIsRolling(false);
    setTruthDiceSettling(false);
    setTruthRoundAnimating(false);
    setTruthLogs([]);
    setTruthInviteMembers([]);
    truthRunRoundRef.current = null;
    truthRoundContextRef.current = null;
    if (truthMatchTimerRef.current) {
      clearTimeout(truthMatchTimerRef.current);
      truthMatchTimerRef.current = null;
    }
    if (truthRoundTimerRef.current) {
      clearTimeout(truthRoundTimerRef.current);
      truthRoundTimerRef.current = null;
    }
    if (truthDiceAnimRef.current) {
      clearInterval(truthDiceAnimRef.current);
      truthDiceAnimRef.current = null;
    }
    if (truthDiceSettleTimerRef.current) {
      clearTimeout(truthDiceSettleTimerRef.current);
      truthDiceSettleTimerRef.current = null;
    }
    if (truthPhaseTimerRef.current) {
      clearTimeout(truthPhaseTimerRef.current);
      truthPhaseTimerRef.current = null;
    }
    if (truthCountdownTimerRef.current) {
      clearInterval(truthCountdownTimerRef.current);
      truthCountdownTimerRef.current = null;
    }
    if (truthAutoActionTimerRef.current) {
      clearTimeout(truthAutoActionTimerRef.current);
      truthAutoActionTimerRef.current = null;
    }
    if (truthRoundAnimTimerRef.current) {
      clearTimeout(truthRoundAnimTimerRef.current);
      truthRoundAnimTimerRef.current = null;
    }
    if (truthInviteTimersRef.current.length) {
      truthInviteTimersRef.current.forEach((timer) => clearTimeout(timer));
      truthInviteTimersRef.current = [];
    }
  };

  const openTruthMenu = () => {
    resetTruthState();
    setShowTruthModal(true);
  };

  const openTruthInviteRoom = () => {
    setTruthMode("invite");
    setTruthInviteMembers(
      user
        ? [
            {
              userId: user.id,
              name: user.nickname || "我",
              avatar: user.avatarUrl || "",
              status: "HOST"
            }
          ]
        : []
    );
  };

  const clearTruthPhaseTimers = () => {
    if (truthPhaseTimerRef.current) {
      clearTimeout(truthPhaseTimerRef.current);
      truthPhaseTimerRef.current = null;
    }
    if (truthCountdownTimerRef.current) {
      clearInterval(truthCountdownTimerRef.current);
      truthCountdownTimerRef.current = null;
    }
    if (truthAutoActionTimerRef.current) {
      clearTimeout(truthAutoActionTimerRef.current);
      truthAutoActionTimerRef.current = null;
    }
  };

  const startTruthPhaseCountdown = (seconds, onTimeout) => {
    clearTruthPhaseTimers();
    setTruthPhaseCountdown(seconds);
    truthCountdownTimerRef.current = window.setInterval(() => {
      setTruthPhaseCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    truthPhaseTimerRef.current = window.setTimeout(() => {
      clearTruthPhaseTimers();
      setTruthPhaseCountdown(0);
      onTimeout?.();
    }, seconds * 1000);
  };

  const startTruthChallenge = (opponent) => {
    setTruthOpponent(opponent);
    setTruthDiceResult(null);
    setTruthRoundIndex(0);
    setTruthAnswerDraft("");
    setTruthAwaitingMyAnswer(false);
    setTruthQuestionOptions([]);
    setTruthPhase("idle");
    setTruthPhaseCountdown(0);
    setTruthCurrentQuestion("");
    setTruthCurrentDifficultyLabel(TRUTH_DIFFICULTY_OPTIONS.find((item) => item.id === truthDifficulty)?.label || "轻松");
    setTruthRollingDice({ me: 1, peer: 1 });
    setTruthIsRolling(false);
    setTruthLogs([]);
    setTruthMode("playing");

    const scheduleNextRound = (nextRoundIdx) => {
      if (nextRoundIdx >= TRUTH_ROUNDS_PER_GAME) {
        setTruthMode("result");
        setTruthPhase("result");
        setTruthAwaitingMyAnswer(false);
        setTruthIsRolling(false);
        clearTruthPhaseTimers();
        return;
      }
      if (truthRoundTimerRef.current) clearTimeout(truthRoundTimerRef.current);
      truthRoundTimerRef.current = window.setTimeout(() => {
        const mixedPoolIds = ["LIGHT", "HEART", "DEEP"];
        const targetDifficultyId = truthDifficulty === "MIXED" ? pickRandomItem(mixedPoolIds, "LIGHT") : truthDifficulty;
        const difficultyLabel = TRUTH_DIFFICULTY_OPTIONS.find((item) => item.id === targetDifficultyId)?.label || "轻松";
        const roundPool = TRUTH_CHALLENGE_BANK.filter((item) => item.difficulty === targetDifficultyId);
        const picked = sampleItems(roundPool.length ? roundPool : truthBankByDifficulty, 3);
        const questionOptions = picked.length ? picked : [{ question: "你最看重关系里的哪一部分？", answer: "我会选择彼此真诚和稳定沟通。" }];
        setTruthQuestionOptions(questionOptions);
        setTruthPickedQuestionIndex(-1);
        setTruthRoundIndex(nextRoundIdx + 1);
        setTruthCurrentQuestion("");
        setTruthCurrentDifficultyLabel(difficultyLabel);
        setTruthAnswerDraft("");
        setTruthAwaitingMyAnswer(false);
        setTruthDiceSettling(false);
        setTruthIsRolling(true);
        setTruthPhase("rolling");
        playTruthDiceSound("roll");
        if (truthDiceAnimRef.current) clearInterval(truthDiceAnimRef.current);
        truthDiceAnimRef.current = window.setInterval(() => {
          setTruthRollingDice({
            me: Math.floor(Math.random() * 6) + 1,
            peer: Math.floor(Math.random() * 6) + 1
          });
        }, 120);

        window.setTimeout(() => {
          if (truthDiceAnimRef.current) {
            clearInterval(truthDiceAnimRef.current);
            truthDiceAnimRef.current = null;
          }
          let myDice = Math.floor(Math.random() * 6) + 1;
          let peerDice = Math.floor(Math.random() * 6) + 1;
          while (myDice === peerDice) {
            myDice = Math.floor(Math.random() * 6) + 1;
            peerDice = Math.floor(Math.random() * 6) + 1;
          }
          const meLose = myDice < peerDice;
          setTruthIsRolling(false);
          setTruthRollingDice({ me: myDice, peer: peerDice });
          setTruthDiceSettling(true);
          playTruthDiceSound("settle");
          if (truthDiceSettleTimerRef.current) clearTimeout(truthDiceSettleTimerRef.current);
          truthDiceSettleTimerRef.current = window.setTimeout(() => setTruthDiceSettling(false), 420);
          setTruthDiceResult({
            round: nextRoundIdx + 1,
            me: myDice,
            peer: peerDice,
            meLose,
            question: "",
            answer: "",
            difficultyLabel
          });
          setTruthLogs((prev) => [
            ...prev,
            `第 ${nextRoundIdx + 1} 回合：你 ${myDice} 点，对方 ${peerDice} 点，${meLose ? "你" : opponent?.name || "对方"}点数更低。`
          ]);
          truthRoundContextRef.current = { nextRoundIdx, meLose, questionOptions, difficultyLabel, picked: false };
          setTruthPhase("pick");

          const pickQuestion = (item, optionIndex = -1) => {
            const ctx = truthRoundContextRef.current;
            if (!ctx || ctx.picked) return;
            ctx.picked = true;
            clearTruthPhaseTimers();
            setTruthPickedQuestionIndex(optionIndex);
            truthAutoActionTimerRef.current = window.setTimeout(() => {
              setTruthCurrentQuestion(item.question);
              setTruthDiceResult((prev) => (prev ? { ...prev, question: item.question, answer: item.answer } : prev));
              setTruthLogs((prev) => [...prev, `系统题目（${difficultyLabel}）：${item.question}`]);
              setTruthPhase("answer");
              if (ctx.meLose) {
                setTruthAwaitingMyAnswer(true);
                startTruthPhaseCountdown(12, () => {
                  setTruthAwaitingMyAnswer(false);
                  setTruthLogs((prev) => [...prev, "你回答：超时未作答"]);
                  setTruthPhase("review");
                  startTruthPhaseCountdown(3, () => scheduleNextRound(nextRoundIdx + 1));
                });
                return;
              }
              setTruthAwaitingMyAnswer(false);
              startTruthPhaseCountdown(10, () => {
                setTruthLogs((prev) => [...prev, `${opponent?.name || "对方"}回答：${item.answer}`]);
                setTruthPhase("review");
                startTruthPhaseCountdown(3, () => scheduleNextRound(nextRoundIdx + 1));
              });
            }, 320);
          };

          if (meLose) {
            startTruthPhaseCountdown(8, () => {
              const autoItem = pickRandomItem(questionOptions, questionOptions[0]);
              pickQuestion(autoItem, questionOptions.findIndex((q) => q.question === autoItem?.question));
            });
            truthAutoActionTimerRef.current = window.setTimeout(() => {
              const autoItem = pickRandomItem(questionOptions, questionOptions[0]);
              pickQuestion(autoItem, questionOptions.findIndex((q) => q.question === autoItem?.question));
            }, 3000 + Math.floor(Math.random() * 3000));
            return;
          }
          startTruthPhaseCountdown(8, () => {
            const autoItem = pickRandomItem(questionOptions, questionOptions[0]);
            pickQuestion(autoItem, questionOptions.findIndex((q) => q.question === autoItem?.question));
          });
          truthRunRoundRef.current = (choiceQuestion) => pickQuestion(choiceQuestion);
        }, 1300);
      }, 260);
    };

    truthRunRoundRef.current = scheduleNextRound;
    scheduleNextRound(0);
  };

  const submitTruthAnswer = () => {
    const finalAnswer = truthAnswerDraft.trim();
    if (!truthAwaitingMyAnswer || finalAnswer.length < truthAnswerMinLen) return;
    clearTruthPhaseTimers();
    setTruthAwaitingMyAnswer(false);
    setTruthLogs((prev) => [...prev, `你回答：${finalAnswer}`]);
    setTruthPhase("review");
    const nextIdx = Number(truthRoundIndex || 0);
    startTruthPhaseCountdown(3, () => truthRunRoundRef.current?.(nextIdx));
  };

  const chooseTruthQuestion = (idx) => {
    if (truthPhase !== "pick" || truthDiceResult?.meLose || truthPickedQuestionIndex >= 0) return;
    const target = truthQuestionOptions[idx];
    if (!target) return;
    setTruthPickedQuestionIndex(idx);
    truthRunRoundRef.current?.(target);
  };

  const startTruthMatch = () => {
    if (isTruthMatching) return;
    setTruthMode("match");
    setIsTruthMatching(true);
    if (truthMatchTimerRef.current) clearTimeout(truthMatchTimerRef.current);
    truthMatchTimerRef.current = window.setTimeout(() => {
      const source = hiddenProfiles.length
        ? hiddenProfiles
        : [{ id: "truth-fallback", nickname: "隐藏款", age: 24, city: "同城", hobbies: "摄影,电影", avatar: "", gender: "FEMALE" }];
      const target = source[Math.floor(Math.random() * source.length)];
      setIsTruthMatching(false);
      startTruthChallenge({
        id: target.id,
        name: target.nickname || "隐藏款",
        avatar: target.avatar || "",
        city: target.city || "同城",
        isBot: true
      });
    }, 1400);
  };

  const startTruthInvite = (friend) => {
    if (!friend?.id) return;
    setTruthInviteMembers((prev) => {
      if (prev.some((item) => item.userId === friend.id)) return prev;
      return [
        ...prev,
        {
          userId: friend.id,
          name: friend.name || "好友",
          avatar: friend.avatar || "",
          status: "INVITED"
        }
      ];
    });
    const timer = window.setTimeout(() => {
      setTruthInviteMembers((prev) =>
        prev.map((item) =>
          item.userId === friend.id && item.status === "INVITED" ? { ...item, status: "ACCEPTED" } : item
        )
      );
    }, 1200 + Math.floor(Math.random() * 1200));
    truthInviteTimersRef.current.push(timer);
  };

  const startTruthInviteRoomGame = () => {
    const opponent = truthInviteMembers.find((item) => item.status === "ACCEPTED" && item.userId !== user?.id);
    if (!opponent) {
      setChatNotice("请等待至少1位好友接受邀请");
      return;
    }
    startTruthChallenge({
      id: opponent.userId,
      name: opponent.name || "对方",
      avatar: opponent.avatar || "",
      city: "好友房",
      isBot: false
    });
  };

  const handleTruthProfileGate = () => {
    if (isMembershipValid) {
      setChatNotice("会员已开通，可查看对方详细资料并继续联系。");
      return;
    }
    setMembershipGateContext("truth");
    setShowMembershipGate(true);
  };

  const handleTruthContact = async () => {
    if (!truthOpponent?.id) return;
    if (!isMembershipValid) {
      setMembershipGateContext("truth");
      setShowMembershipGate(true);
      return;
    }
    try {
      await sendFriendRequest(truthOpponent.id, truthOpponent.name || "TA");
      setShowTruthModal(false);
      resetTruthState();
      navigate("/chat");
    } catch (error) {
      setChatNotice(error.message || "联系失败，请稍后重试");
    }
  };

  const closeTruthModal = () => {
    setShowTruthModal(false);
    resetTruthState();
  };

  const applyTacitRoom = (room) => {
    if (!room) return;
    setTacitRoomId(room.id || "");
    setTacitRoom(room);
    if (room.status === "WAITING") setTacitMode("room");
    if (room.status === "IN_PROGRESS") setTacitMode("playing");
    if (room.status === "FINISHED") setTacitMode("result");
  };

  const loadTacitInvitations = async () => {
    const res = await fetch(`${API}/tacit/invitations`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "拉取默契挑战邀请失败");
    setTacitInvitations(Array.isArray(data.invitations) ? data.invitations : []);
  };

  const ensureTacitFriendRoom = async () => {
    if (tacitRoomId) return tacitRoomId;
    const res = await fetch(`${API}/tacit/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "创建默契挑战好友房失败");
    applyTacitRoom(data.room);
    return data.room.id;
  };

  const resetTacitSessionRemote = async () => {
    try {
      await fetch(`${API}/tacit/session/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders }
      });
    } catch (_error) {}
  };

  const startTacitMatch = async () => {
    if (isTacitMatching || tacitPollingRef.current) return;
    await resetTacitSessionRemote();
    setTacitRoom(null);
    setTacitRoomId("");
    setIsTacitMatching(true);
    setTacitMode("match");
    try {
      const res = await fetch(`${API}/tacit/match/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "匹配失败");
      if (data.matched && data.room) {
        applyTacitRoom(data.room);
        setIsTacitMatching(false);
        return;
      }
      tacitPollingRef.current = window.setInterval(async () => {
        try {
          const statusRes = await fetch(`${API}/tacit/match/status`, { headers: authHeaders });
          const statusData = await statusRes.json();
          if (statusData?.matched && statusData.room) {
            clearInterval(tacitPollingRef.current);
            tacitPollingRef.current = null;
            setIsTacitMatching(false);
            applyTacitRoom(statusData.room);
          }
        } catch (_error) {}
      }, 2000);
    } catch (error) {
      setChatNotice(error.message || "匹配失败");
      setIsTacitMatching(false);
    }
  };

  const inviteTacitFriend = (friend) => {
    ensureTacitFriendRoom()
      .then((roomId) =>
        fetch(`${API}/tacit/rooms/${roomId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ userId: friend.id })
        })
      )
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "邀请失败");
        applyTacitRoom(data.room);
        setChatNotice(`已邀请 ${friend.name} 参与默契挑战`);
      })
      .catch((error) => setChatNotice(error.message || "邀请失败"));
  };

  const respondTacitInvite = async (action) => {
    if (!tacitRoomId) return;
    const res = await fetch(`${API}/tacit/rooms/${tacitRoomId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "处理邀请失败");
    applyTacitRoom(data.room);
  };

  const startTacitRoomGame = async () => {
    if (!tacitRoomId) return;
    const res = await fetch(`${API}/tacit/rooms/${tacitRoomId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "开始失败");
    applyTacitRoom(data.room);
  };

  const chooseTacitAnswer = async (value) => {
    if (!tacitRoomId || !tacitCurrentQuestion) return;
    const res = await fetch(`${API}/tacit/rooms/${tacitRoomId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ questionId: tacitCurrentQuestion.id, choice: value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "提交答案失败");
    applyTacitRoom(data.room);
  };

  const confirmTacitAnswer = async () => {
    if (!tacitDraftChoice || tacitMyChoice) return;
    if (tacitCurrentQuestion?.id) setTacitSubmittedQuestionId(tacitCurrentQuestion.id);
    setTacitConfirming(true);
    try {
      await chooseTacitAnswer(tacitDraftChoice);
    } catch (error) {
      setTacitSubmittedQuestionId("");
      throw error;
    } finally {
      setTacitConfirming(false);
    }
  };

  const subscribeMembership = async (plan) => {
    if (!user?.id) return;
    setMembershipSubmitting(true);
    try {
      const res = await fetch(`${API}/membership/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "开通会员失败");
      setUser(data.user || user);
      setShowMembershipGate(false);
      setChatNotice(`会员开通成功，已支付 ${data.paid} 元`);
    } catch (error) {
      setChatNotice(error.message || "开通会员失败");
    } finally {
      setMembershipSubmitting(false);
    }
  };

  const onTacitAddFriend = async () => {
    if (!tacitPeerMember?.userId) return;
    if (!isMembershipValid) {
      setMembershipGateContext("invite");
      setShowMembershipGate(true);
      return;
    }
    try {
      await sendFriendRequest(tacitPeerMember.userId, tacitPeerMember.name || "对方");
    } catch (error) {
      setChatNotice(error.message || "发起好友请求失败");
    }
  };

  const enterTacitInvitationRoom = async (roomId) => {
    const res = await fetch(`${API}/tacit/rooms/${roomId}`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "进入房间失败");
    applyTacitRoom(data.room);
  };

  const inviteTacitReplay = () => {
    setMembershipGateContext("invite");
    setShowMembershipGate(true);
  };

  const rematchTacitRound = () => {
    setTacitRoom(null);
    setTacitRoomId("");
    setTacitMode("match");
    startTacitMatch();
  };

  const resetTacitSessionState = () => {
    setShowTacitModal(false);
    setTacitMode("menu");
    setTacitRoom(null);
    setTacitRoomId("");
    setIsTacitMatching(false);
    if (tacitPollingRef.current) {
      clearInterval(tacitPollingRef.current);
      tacitPollingRef.current = null;
    }
  };
  const closeTacitModal = async () => {
    const hasActiveRound = Boolean(tacitRoomId) || isTacitMatching || tacitMode !== "menu";
    if (hasActiveRound) {
      const confirmed = window.confirm("确定退出本轮游戏吗？退出后将清空本轮进度并需要重新匹配。");
      if (!confirmed) return;
    }
    await resetTacitSessionRemote();
    resetTacitSessionState();
  };

  const enterWerewolfMatch = () => {
    setWerewolfMode("match");
    setIsWerewolfMatching(false);
  };

  const enterWerewolfRoom = () => {
    setWerewolfMode("room");
    setShowWerewolfInvitePanel(false);
    ensureWerewolfFriendRoom().catch((error) => setChatNotice(error.message || "创建好友房失败"));
  };

  const applyWerewolfRoom = (room) => {
    if (!room) return;
    setWerewolfRoomId(room.id || "");
    setWerewolfRoomMembers(
      Array.isArray(room.members)
        ? room.members.map((m) => ({
            id: m.userId,
            name: m.name,
            accepted: m.status === "ACCEPTED" || m.status === "HOST",
            owner: m.status === "HOST",
            status: m.status
          }))
        : []
    );
    setWerewolfGame(room.game || null);
    if (room.game?.status === "IN_GAME") {
      setWerewolfMode("playing");
    }
  };

  const ensureWerewolfFriendRoom = async () => {
    if (werewolfRoomId) return werewolfRoomId;
    const res = await fetch(`${API}/werewolf/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "创建好友房失败");
    applyWerewolfRoom(data.room);
    return data.room.id;
  };

  const loadWerewolfInvitations = async () => {
    const res = await fetch(`${API}/werewolf/invitations`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "拉取狼人杀邀请失败");
    setWerewolfInvitations(Array.isArray(data.invitations) ? data.invitations : []);
  };

  const resetWerewolfSessionRemote = async () => {
    try {
      await fetch(`${API}/werewolf/session/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders }
      });
    } catch (_error) {}
  };

  const startWerewolfMatching = async () => {
    if (isWerewolfMatching || werewolfPollingRef.current) return;
    await resetWerewolfSessionRemote();
    setWerewolfRoomId("");
    setWerewolfRoomMembers([]);
    setWerewolfGame(null);
    setIsWerewolfMatching(true);
    fetch(`${API}/werewolf/match/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders }
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "匹配失败");
        if (data.matched && data.room) {
          applyWerewolfRoom(data.room);
          setWerewolfRulePack(buildWerewolfRulePack(6, "多人匹配"));
          setWerewolfMode(data.room?.game ? "playing" : "match");
          setIsWerewolfMatching(false);
          return;
        }
        werewolfPollingRef.current = window.setInterval(async () => {
          try {
            const statusRes = await fetch(`${API}/werewolf/match/status`, { headers: authHeaders });
            const statusData = await statusRes.json();
            if (!statusRes.ok) throw new Error(statusData.message || "查询匹配状态失败");
            if (statusData.matched && statusData.room) {
              applyWerewolfRoom(statusData.room);
              setWerewolfRulePack(buildWerewolfRulePack(6, "多人匹配"));
              setWerewolfMode(statusData.room?.game ? "playing" : "match");
              setIsWerewolfMatching(false);
              clearInterval(werewolfPollingRef.current);
              werewolfPollingRef.current = null;
            }
          } catch (_error) {
            // keep polling for transient errors
          }
        }, 2000);
      })
      .catch((error) => {
        setChatNotice(error.message || "匹配失败");
        setIsWerewolfMatching(false);
      });
  };

  const startWerewolfRoomGame = () => {
    if (!werewolfRoomId) return;
    fetch(`${API}/werewolf/rooms/${werewolfRoomId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders }
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "开局失败");
        applyWerewolfRoom(data.room);
        setWerewolfRulePack(buildWerewolfRulePack(data.room.acceptedCount || acceptedMemberCount, "好友房"));
        setWerewolfMode(data.room?.game ? "playing" : "judge");
      })
      .catch((error) => setChatNotice(error.message || "开局失败"));
  };

  const submitWerewolfAction = async (payload) => {
    if (!werewolfRoomId) return;
    setWerewolfActionLoading(true);
    try {
      const res = await fetch(`${API}/werewolf/rooms/${werewolfRoomId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "操作失败");
      applyWerewolfRoom(data.room);
      setWerewolfMode("playing");
      if (payload.type === "speak") setWerewolfSpeechDraft("");
    } catch (error) {
      setChatNotice(error.message || "操作失败");
    } finally {
      setWerewolfActionLoading(false);
    }
  };

  const refreshWerewolfRoom = async () => {
    if (!werewolfRoomId) return;
    const res = await fetch(`${API}/werewolf/rooms/${werewolfRoomId}`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "刷新狼人杀房间失败");
    applyWerewolfRoom(data.room);
  };

  const inviteWerewolfFriend = (friend) => {
    const now = Date.now();
    const expireAt = Number(werewolfInviteCooldowns[friend.id] || 0);
    if (expireAt > now) return;
    setWerewolfInviteCooldowns((prev) => ({ ...prev, [friend.id]: now + 30000 }));
    ensureWerewolfFriendRoom()
      .then((roomId) =>
        fetch(`${API}/werewolf/rooms/${roomId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ userId: friend.id })
        })
      )
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "邀请失败");
        applyWerewolfRoom(data.room);
        setChatNotice(`已邀请 ${friend.name}，30秒后可再次邀请`);
      })
      .catch((error) => {
        setWerewolfInviteCooldowns((prev) => ({ ...prev, [friend.id]: 0 }));
        setChatNotice(error.message || "邀请失败");
      });
  };

  const respondWerewolfInvite = async (action) => {
    if (!werewolfRoomId) return;
    const res = await fetch(`${API}/werewolf/rooms/${werewolfRoomId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "处理邀请失败");
    applyWerewolfRoom(data.room);
  };

  const closeWerewolfModal = async () => {
    await resetWerewolfSessionRemote();
    setShowWerewolfModal(false);
    setShowWerewolfInvitePanel(false);
    setWerewolfInviteCooldowns({});
    setIsWerewolfMatching(false);
    setWerewolfRoomId("");
    setWerewolfRoomMembers([]);
    setWerewolfMode("menu");
    setWerewolfGame(null);
    setWerewolfSpeechDraft("");
    setWerewolfActionLoading(false);
    if (werewolfPollingRef.current) {
      clearInterval(werewolfPollingRef.current);
      werewolfPollingRef.current = null;
    }
  };

  const enterWerewolfInvitationRoom = async (roomId) => {
    const res = await fetch(`${API}/werewolf/rooms/${roomId}`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "进入房间失败");
    applyWerewolfRoom(data.room);
    setWerewolfMode(data.room?.game ? "playing" : "room");
  };

  const publishMyPost = () => {
    const text = newPostText.trim();
    if (!text) return;
    const post = {
      id: `mine-${Date.now()}`,
      text,
      likes: 0,
      createdAt: "刚刚"
    };
    setMyPosts((prev) => [post, ...prev]);
    setNewPostText("");
  };

  if (!user) {
    return (
      <main className="login-page">
        <div className="close-btn">x</div>
        <p className="help-link">登录遇到困难？</p>

        <div className="hero-avatars">
          {heroAvatarList.map((avatar) => (
            <img
              key={avatar.src}
              src={resolveAssetUrl(avatar.src)}
              alt=""
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = MALE_SYMBOL_AVATAR;
              }}
            />
          ))}
        </div>
        <p className="hero-text">来盲盒开出属于你的隐藏款</p>

        {authMode === "login" ? (
          <form className="auth-form" onSubmit={onLogin}>
            <input
              placeholder="盲盒号 / 手机号"
              value={loginForm.account}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, account: e.target.value }))}
              required
            />
            <input
              placeholder="请输入密码"
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
            <button className={`login-main-btn ${canSubmitLogin ? "active" : ""}`} type="submit" disabled={!canSubmitLogin}>
              登录
            </button>
          </form>
        ) : (
          <form className="auth-form register-form" onSubmit={onRegister}>
            <input
              ref={registerPhoneRef}
              placeholder="手机号"
              autoComplete="tel"
              value={registerForm.phone}
              onInput={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))}
              required
            />
            <input
              ref={registerPasswordRef}
              placeholder="密码(至少6位)"
              type="password"
              autoComplete="new-password"
              value={registerForm.password}
              onInput={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
            <div
              className="sms-code-wrap"
              onClick={() => document.getElementById("sms-code-input")?.focus()}
            >
              <input
                id="sms-code-input"
                className="sms-code-hidden-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={registerForm.smsCode}
                onChange={(e) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    smsCode: e.target.value.replace(/\D/g, "").slice(0, 6)
                  }))
                }
                required
              />
              <div className="sms-code-grid">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <span
                    key={`sms-box-${idx}`}
                    className={`sms-code-cell ${registerForm.smsCode[idx] ? "filled" : ""}`}
                  >
                    {registerForm.smsCode[idx] || ""}
                  </span>
                ))}
              </div>
              <small>短信验证码（测试码：123456）</small>
            </div>
            <button
              className={`login-main-btn ${canSubmitRegisterBasic ? "active" : ""}`}
              type="submit"
              disabled={!canSubmitRegisterBasic}
            >
              验证并注册
            </button>
          </form>
        )}

        <div className="agree-row">
          <label>
            <input
              type="checkbox"
              checked={agreed}
              disabled={authMode === "register" && registerForm.smsCode.trim().length !== 6}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            我已阅读并同意《盲盒用户协议》和《盲盒隐私政策》
          </label>
        </div>

        <div className="switch-row">
          {authMode === "login" ? (
            <button className="text-btn" onClick={() => setAuthMode("register")} type="button">
              没有注册过？点击注册
            </button>
          ) : (
            <button className="text-btn" onClick={() => setAuthMode("login")} type="button">
              已有账号？返回登录
            </button>
          )}
        </div>

        <div className="quick-login-row">
          <button className="quick-btn" type="button" disabled title="功能暂未开放">
            本机号码一键登录
          </button>
          <button className="quick-btn wechat" type="button" disabled title="功能暂未开放">
            微信登录
          </button>
        </div>

        {message && <p className="msg auth-msg">{message}</p>}
      </main>
    );
  }

  if (needsProfileSetup) {
    return (
      <main className="setup-page">
        <form className="profile-setup-card setup-standalone-card" onSubmit={onCompleteProfile}>
            <h3>完善新用户资料</h3>
            <p>资料仅用于匹配推荐，提交后即可正常使用。</p>
            <div className="setup-photo-block">
              <strong>新用户相册（至少1张）</strong>
              <div className="setup-photo-grid">
                {profileSetupPhotos.map((photo, idx) => (
                  <div key={`setup-photo-${idx}`} className="modern-photo-item">
                    <img src={resolveAssetUrl(photo)} alt={`相册${idx + 1}`} />
                    <button
                      type="button"
                      className="modern-photo-remove"
                      onClick={() =>
                        setProfileSetupPhotos((prev) => {
                          const next = prev.filter((_, i) => i !== idx);
                          setProfileSetupForm((form) => ({ ...form, avatarUrl: next[0] || "" }));
                          return next;
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 6 - profileSetupPhotos.length) }, (_, idx) => (
                  <label key={`setup-upload-${idx}`} className="modern-photo-placeholder setup-upload-slot">
                    点击上传
                    <input type="file" accept="image/*" onChange={onPickSetupPhoto} hidden />
                  </label>
                ))}
              </div>
            </div>
            <div className="birth-select-row">
              <select
                value={profileSetupForm.birthYear}
                onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, birthYear: e.target.value }))}
                required
              >
                <option value="">出生年</option>
                {Array.from({ length: 43 }, (_, idx) => 1980 + idx).map((year) => (
                  <option key={`year-${year}`} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
              <select
                value={profileSetupForm.birthMonth}
                onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, birthMonth: e.target.value }))}
                required
              >
                <option value="">月</option>
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((month) => (
                  <option key={`month-${month}`} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
              <select
                value={profileSetupForm.birthDay}
                onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, birthDay: e.target.value }))}
                required
              >
                <option value="">日</option>
                {Array.from({ length: 31 }, (_, idx) => idx + 1).map((day) => (
                  <option key={`day-${day}`} value={day}>
                    {day}日
                  </option>
                ))}
              </select>
            </div>
            <div className="gender-select-row">
              <select
                value={profileSetupForm.gender}
                onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, gender: e.target.value }))}
                required
              >
                <option value="">性别</option>
                <option value="MALE">男</option>
                <option value="FEMALE">女</option>
              </select>
            </div>
            <input
              placeholder="用户昵称"
              value={profileSetupForm.nickname}
              onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, nickname: e.target.value }))}
              required
            />
            <input
              placeholder="家乡"
              value={profileSetupForm.hometown}
              onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, hometown: e.target.value }))}
              required
            />
            <input
              placeholder="现居地"
              value={profileSetupForm.currentCity}
              onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, currentCity: e.target.value }))}
              required
            />
            <input
              placeholder="收入（如 10k-20k）"
              value={profileSetupForm.income}
              onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, income: e.target.value }))}
              required
            />
            <input
              placeholder="行业"
              value={profileSetupForm.industry}
              onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, industry: e.target.value }))}
              required
            />
            <input
              placeholder="爱好（用逗号分隔）"
              value={profileSetupForm.hobbies}
              onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, hobbies: e.target.value }))}
              required
            />
            <input
              placeholder="对另一半的要求"
              value={profileSetupForm.partnerExpectation}
              onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, partnerExpectation: e.target.value }))}
              required
            />
            <button type="submit">提交资料</button>
            {message && <p className="msg auth-msg">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <div
      className={`main-app ${tab === "chat" && activeConversation ? "chat-detail-mode" : ""} ${tab === "planet-match" ? "planet-match-route" : ""}`}
    >
      {chatNotice && <div className="chat-notice-banner">{chatNotice}</div>}
      <header className={`main-header ${tab === "me" ? "me-header" : ""} ${tab === "planet-match" ? "main-header--cosmic" : ""}`}>
        {tab === "planet-match" ? (
          <>
            <button type="button" className="header-btn header-btn--cosmic" onClick={leavePlanetMatchPage}>
              返回
            </button>
            <h1>星球匹配</h1>
            <div className="header-placeholder" />
          </>
        ) : tab === "me" ? (
          <>
            {mePage === "settings" || mePage === "profile-edit" ? (
              <button
                className="header-btn"
                onClick={() => {
                  if (mePage === "profile-edit") {
                    setMePage("home");
                    return;
                  }
                  if (mePage === "settings" && meDetailPage) {
                    setMeDetailPage("");
                    return;
                  }
                  setMePage("home");
                }}
              >
                返回
              </button>
            ) : getUserPrimaryRawImageUrl(user) && !meHeaderAvatarFailed ? (
              <img
                className="header-avatar-img"
                src={resolveAssetUrl(getUserPrimaryRawImageUrl(user))}
                alt=""
                onError={() => setMeHeaderAvatarFailed(true)}
              />
            ) : (
              <div className="avatar-dot">{user.nickname.slice(0, 1).toUpperCase()}</div>
            )}
            <h1>
              {mePage === "settings"
                ? meDetailPage === "account-security"
                  ? "账号与安全"
                  : "设置"
                : mePage === "profile-edit"
                  ? "编辑资料"
                : "自己"}
            </h1>
            {mePage === "settings" || mePage === "profile-edit" ? (
              <div className="header-placeholder" />
            ) : (
              <button className="header-btn icon-btn" onClick={() => setMePage("settings")} aria-label="设置">
                ⚙
              </button>
            )}
          </>
        ) : (
          <>
            <div className="avatar-dot">{user.nickname.slice(0, 1).toUpperCase()}</div>
            <h1>盲盒星球</h1>
            <div className="header-placeholder" />
          </>
        )}
      </header>

      {tab === "planet" && (
        <section className="main-content">
          <div className="hero-match-card">
            <div className="hero-level">附近推荐</div>
            <div className="hero-profile-list">
              {(visibleHiddenProfiles.length ? visibleHiddenProfiles : [{ id: "empty" }]).map((item) => (
                <div key={item.id} className="hero-profile-card">
                  {item.id === "empty" ? (
                    <p className="feed-tip">正在加载隐藏款资料...</p>
                  ) : (
                    <>
                      <img
                        className="hero-profile-cover"
                        src={resolveAssetUrl(item.avatar || "")}
                        alt={item.nickname || "隐藏款"}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = item.gender === "MALE" ? MALE_SYMBOL_AVATAR : FEMALE_SYMBOL_AVATAR;
                        }}
                      />
                      <div className="hero-profile-meta">
                        <strong>{item.nickname || "隐藏款"}</strong>
                        <span>
                          {item.age || "-"}岁 · {item.city || "同城"}
                        </span>
                        <small>{item.hobbies || "期待与你认识"}</small>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="hero-title">寻找你附近的隐藏款</p>
            <button className="hero-action" type="button" onClick={startPlanetMatchFlow}>
              开始寻找
            </button>
          </div>

          <h3 className="section-title">配对玩游戏</h3>
          <div className="game-grid">
            <div className="game-card">
              <h4>猜句子接龙</h4>
              <p>15.1万人正在玩</p>
              <button type="button" onClick={openSentenceMenu}>
                进入
              </button>
            </div>
            <div className="game-card">
              <h4>狼人杀</h4>
              <p>5.5万人正在玩</p>
              <button type="button" onClick={openWerewolfMenu}>
                进入
              </button>
            </div>
            <div className="game-card">
              <h4>真心话挑战</h4>
              <p>1.5万人正在玩</p>
              <button type="button" onClick={openTruthMenu}>
                进入
              </button>
            </div>
            <div className="game-card">
              <h4>二选一默契挑战</h4>
              <p>6.5万人正在玩</p>
              <button type="button" onClick={openTacitMenu}>
                进入
              </button>
            </div>
          </div>

          <div className="status-card">
            <p>盲盒星球在线：{onlineCount.toLocaleString()} 人</p>
            {blindBoxTarget ? <p>已匹配到 1 位异性用户，点击“开始寻找”可再次匹配</p> : <p>点击上方开始寻找，立即进入异性匹配</p>}
          </div>
        </section>
      )}

      {tab === "square" && (
        <section
          className="main-content square-feed"
          ref={squareFeedRef}
          onScroll={onSquareScroll}
          onTouchStart={onSquareTouchStart}
          onTouchMove={onSquareTouchMove}
          onTouchEnd={onSquareTouchEnd}
        >
          <h2>广场展示</h2>
          <button className="refresh-btn" onClick={() => loadSquarePosts(true)}>
            换一批
          </button>
          <p className="pull-hint">{pullHint}</p>
          {posts.map((post) => (
            <div className="post dark-post" key={post.id}>
              <div className="post-head">
                <div className={`blindbox-avatar ${post.gender === "MALE" ? "male-avatar" : "female-avatar"}`}>
                  {post.gender === "MALE" ? "♂" : "♀"}
                </div>
                <div className="post-meta">
                  <strong>{post.nickname || "盲盒用户"}</strong>
                  <small>
                    {post.createdAt || "刚刚"} · {post.distanceKm ?? "-"}km
                  </small>
                </div>
              </div>
              <p>{post.text}</p>
              <small>点赞 {post.likes}</small>
            </div>
          ))}
          {squareLoading && <p className="feed-tip">加载中...</p>}
          {!hasMorePosts && <p className="feed-tip">没有更多动态了</p>}
        </section>
      )}

      {tab === "chat" && (
        <section className={`main-content chat-page ${activeConversation ? "chat-page-detail" : ""}`}>
          {activeConversation ? (
            <>
              <div className="chat-detail-page">
                <div className="chat-detail-header">
                  <button className="chat-detail-back" onClick={() => setActiveConversation(null)}>
                    返回
                  </button>
                  <strong>{activeConversation.name}</strong>
                  <button className="chat-detail-more" onClick={() => setMessage("会话设置功能开发中")}>
                    ⋯
                  </button>
                </div>
                <div className="chat-detail-list">
                  {chatMessages.length === 0 ? (
                    <p className="feed-tip">还没有消息，打个招呼吧</p>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMe = String(msg.fromUserId) === String(user.id);
                      return (
                        <div
                          key={msg.id}
                          className={`chat-msg-row ${isMe ? "chat-msg-row--me" : "chat-msg-row--peer"}`}
                        >
                          {!isMe && (
                            <img
                              src={chatDetailPeerAvatarSrc}
                              alt=""
                              className="chat-msg-avatar"
                              onError={(e) => {
                                e.currentTarget.src = MALE_SYMBOL_AVATAR;
                              }}
                            />
                          )}
                          <div className={`chat-bubble ${isMe ? "me-bubble" : "other-bubble"}`}>
                            {msg.kind === "IMAGE" ? (
                              resolveMediaUrl(msg.mediaUrl) && !brokenImageIds.includes(msg.id) ? (
                                <img
                                  src={resolveMediaUrl(msg.mediaUrl)}
                                  alt=""
                                  className="chat-image"
                                  onClick={() => window.open(resolveMediaUrl(msg.mediaUrl), "_blank")}
                                  onError={() =>
                                    setBrokenImageIds((prev) => (prev.includes(msg.id) ? prev : [...prev, msg.id]))
                                  }
                                />
                              ) : (
                                <span className="chat-image-missing">图片已失效</span>
                              )
                            ) : msg.kind === "AUDIO" ? (
                              <div className="chat-audio-wrap">
                                <div className="audio-wave">
                                  <span />
                                  <span />
                                  <span />
                                  <span />
                                  <span />
                                  <span />
                                </div>
                                <audio controls preload="metadata" src={resolveMediaUrl(msg.mediaUrl)} />
                                <span>{msg.audioDurationSec ? `${msg.audioDurationSec}s` : "语音"}</span>
                              </div>
                            ) : (
                              msg.text
                            )}
                          </div>
                          {isMe && (
                            <img
                              src={chatDetailMyAvatarSrc}
                              alt=""
                              className="chat-msg-avatar"
                              onError={(e) => {
                                e.currentTarget.src = MALE_SYMBOL_AVATAR;
                              }}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="chat-detail-input-wrap">
                  <label className="chat-media-btn" title="发送图片">
                    🖼
                    <input type="file" accept="image/*" onChange={onPickImage} hidden />
                  </label>
                  <button
                    type="button"
                    className={`chat-media-btn ${isRecording ? "recording-btn" : ""}`}
                    onClick={toggleRecord}
                    title={isRecording ? "结束录音并发送" : "录音"}
                  >
                    {isRecording ? "■" : "🎤"}
                  </button>
                  <input
                    placeholder="输入消息..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendChatMessage();
                    }}
                  />
                  <button type="button" onClick={sendChatMessage}>
                    发送
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="chat-top-tabs">
                <button
                  className={chatMode === "contacts" ? "active" : ""}
                  onClick={() => {
                    setChatMode("contacts");
                    setChatKeyword("");
                  }}
                >
                  通讯录
                </button>
                <button className={chatMode === "chat" ? "active" : ""} onClick={() => setChatMode("chat")}>
                  聊天
                </button>
              </div>
              <div className="chat-search-wrap">
                <input
                  className="chat-search"
                  placeholder={
                    chatMode === "contacts" ? "搜索好友昵称或状态" : "搜索备注、昵称或者聊天记录"
                  }
                  value={chatKeyword}
                  onChange={(e) => setChatKeyword(e.target.value)}
                />
                <button
                  className="chat-add-btn"
                  onClick={() => {
                    setAddFriendKeyword("");
                    setShowAddFriendModal(true);
                    loadIncomingRequests().catch(() => setIncomingRequests([]));
                  }}
                >
                  ＋
                  {incomingRequestCount > 0 && (
                    <span className="chat-add-badge">{incomingRequestCount > 99 ? "99+" : incomingRequestCount}</span>
                  )}
                </button>
              </div>
              {chatMode === "chat" ? (
                <div className="chat-list">
                  {incomingRequestCount > 0 && (
                    <button
                      type="button"
                      className="chat-system-item"
                      onClick={() => {
                        setAddFriendKeyword("");
                        setShowAddFriendModal(true);
                        loadIncomingRequests().catch(() => setIncomingRequests([]));
                      }}
                    >
                      <div className="chat-system-icon">好友</div>
                      <div className="chat-system-main">
                        <strong>新的好友申请</strong>
                        <p>{incomingRequestCount} 条待处理，点击查看并处理</p>
                      </div>
                      <span className="chat-unread">
                        {incomingRequestCount > 99 ? "99+" : incomingRequestCount}
                      </span>
                    </button>
                  )}
                  {filteredConversations.map((item) => (
                    <div
                      key={item.id}
                      className={`chat-swipe-row ${swipedConversationId === item.id ? "open" : ""}`}
                      onTouchStart={(e) => onConversationTouchStart(e, item.id)}
                      onTouchEnd={(e) => onConversationTouchEnd(e, item.id)}
                      onMouseDown={(e) => onConversationMouseDown(e, item.id)}
                      onMouseUp={(e) => onConversationMouseUp(e, item.id)}
                      onMouseLeave={() => {
                        swipeActiveIdRef.current = "";
                      }}
                    >
                      <div className="chat-swipe-actions">
                        <button type="button" className="clean-btn" onClick={onBatchCleanConversations}>
                          批量清理
                        </button>
                        <button type="button" className="pin-btn" onClick={() => onPinConversation(item.id)}>
                          {pinnedConversationIds.includes(item.id) ? "取消置顶" : "置顶"}
                        </button>
                        <button type="button" className="delete-btn" onClick={() => onDeleteConversation(item.id)}>
                          删除
                        </button>
                      </div>
                      <button
                        className="chat-item chat-item-button chat-swipe-content"
                        type="button"
                        onClick={() => {
                          if (swipedConversationId === item.id) {
                            setSwipedConversationId("");
                            return;
                          }
                          openConversation(item);
                        }}
                      >
                        <img src={resolveAssetUrl(item.avatar)} alt={item.name} className="chat-avatar" />
                        <div className="chat-main">
                          <div className="chat-name-row">
                            <strong>{item.name}</strong>
                            <span>{formatChatTime(item.time)}</span>
                          </div>
                          <p>{item.preview}</p>
                        </div>
                        {item.unread > 0 && <span className="chat-unread">{item.unread > 9 ? "9+" : item.unread}</span>}
                      </button>
                    </div>
                  ))}
                  {filteredConversations.length === 0 && <p className="feed-tip">暂无匹配聊天记录</p>}
                </div>
              ) : (
                <div className="contact-list">
                  {filteredContacts.map((item) => (
                    <div key={item.id} className="contact-item">
                      <img src={resolveAssetUrl(item.avatar)} alt={item.name} className="chat-avatar" />
                      <div className="contact-main">
                        <strong>{item.name}</strong>
                        <span>{item.status}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setChatMode("chat");
                          openConversation(item);
                        }}
                      >
                        发消息
                      </button>
                    </div>
                  ))}
                  {filteredContacts.length === 0 && <p className="feed-tip">暂无匹配联系人</p>}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === "me" && (
        <section className="main-content">
          {mePage === "settings" ? (
            meDetailPage === "account-security" ? (
              <div className="settings-list">
                <button className="settings-item" onClick={switchAccount}>
                  <span>切换账号</span>
                  <span>›</span>
                </button>
                <button className="settings-item danger-item" onClick={logout}>
                  <span>退出登录</span>
                  <span>›</span>
                </button>
              </div>
            ) : (
              <div className="settings-list">
                {settingItems.map((item) => (
                  <button
                    key={item}
                    className="settings-item"
                    onClick={() => {
                      if (item === "账户与安全") {
                        setMeDetailPage("account-security");
                        return;
                      }
                      setMessage(`${item} 功能开发中`);
                    }}
                  >
                    <span>{item}</span>
                    <span>›</span>
                  </button>
                ))}
              </div>
            )
          ) : mePage === "profile-edit" ? (
            <div className="profile-edit-page">
              <div className="status-card profile-editor-page modern-edit-page">
                <div className="modern-edit-head">
                  <strong>完善度 85%</strong>
                  <button type="button" onClick={saveProfile}>
                    保存
                  </button>
                </div>

                <div className="modern-edit-section">
                  <p className="modern-edit-title">头像</p>
                  <div className="modern-photo-grid">
                    {editPhotoSlots.map((slot, idx) =>
                      slot.type === "photo" ? (
                        <div className="modern-photo-item" key={`edit-photo-${idx}`}>
                          <img src={slot.src} alt={`头像${idx + 1}`} />
                          <button
                            type="button"
                            className="modern-photo-remove"
                            onClick={() => {
                              setEditProfilePhotos((prev) => {
                                const next = prev.filter((_, photoIdx) => photoIdx !== idx);
                                const nextAvatar = next[0] || "";
                                setProfileForm((form) => ({ ...form, avatarUrl: nextAvatar }));
                                return next;
                              });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          key={`edit-placeholder-${slot.idx}`}
                          type="button"
                          className="modern-photo-placeholder"
                          onClick={() => profilePhotoInputRef.current?.click()}
                        >
                          {slot.label}
                        </button>
                      )
                    )}
                  </div>
                  <label className="upload-avatar-btn modern-upload-btn">
                    上传头像
                    <input ref={profilePhotoInputRef} type="file" accept="image/*" onChange={onPickProfileAvatar} hidden />
                  </label>
                  <input
                    placeholder="头像/封面地址（可选）"
                    value={profileForm.avatarUrl}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                  />
                </div>

                <div className="modern-edit-group">
                  <p className="group-title">基本资料</p>
                  <label className="modern-edit-row input-row">
                    <span>昵称</span>
                    <input
                      value={profileForm.nickname}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, nickname: e.target.value }))}
                    />
                  </label>
                  <div className="modern-edit-row">
                    <span>出生日期</span>
                    <em>{formatBirthDateText(user.birthDate)}</em>
                  </div>
                  <div className="modern-edit-row">
                    <span>正在使用的设备</span>
                    <em>iPhone 17 Pro Max</em>
                  </div>
                </div>

                <div className="modern-edit-group">
                  <p className="group-title">个人信息</p>
                  <label className="modern-edit-row input-row">
                    <span>个人签名</span>
                    <input
                      value={profileForm.partnerExpectation}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, partnerExpectation: e.target.value }))}
                    />
                  </label>
                  <div className="modern-edit-row">
                    <span>月收入</span>
                    <em>{user.income || "5万以上"}</em>
                  </div>
                  <div className="modern-edit-row">
                    <span>身高</span>
                    <em>{user.height || 176}</em>
                  </div>
                  <label className="modern-edit-row input-row">
                    <span>家乡</span>
                    <input
                      value={profileForm.currentCity}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, currentCity: e.target.value }))}
                    />
                  </label>
                  <div className="modern-edit-row">
                    <span>职业</span>
                    <em>{user.industry || "IT/互联网"}</em>
                  </div>
                  <label className="modern-edit-row input-row">
                    <span>盲盒宣言</span>
                    <input
                      value={profileForm.hobbies}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, hobbies: e.target.value }))}
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-hero" style={{ backgroundImage: `url(${profileCover})` }}>
                <div className="profile-hero-mask">
                  <div className="profile-hero-top">
                    <button className="hero-edit-btn" onClick={() => setMePage("profile-edit")}>
                      编辑
                    </button>
                  </div>
                  <div className="profile-gallery-row">
                    {galleryPhotos.map((photo, idx) => (
                      <button
                        key={`${photo}-${idx}`}
                        className={`profile-thumb-btn ${profileCover === photo ? "active-thumb" : ""}`}
                        type="button"
                        onClick={() => setSelectedCover(photo)}
                      >
                        <img src={photo} alt={`相册${idx + 1}`} className="profile-thumb" />
                      </button>
                    ))}
                    <button className="profile-thumb add-thumb-btn" onClick={() => setMePage("profile-edit")}>
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="profile-info-card">
                <h3>{user.nickname}</h3>
                <p>
                  {user.gender === "MALE" ? "男生" : "女生"} · {user.age}岁 · 在线
                </p>
                <p>使用 iPhone 17 Pro Max</p>
              </div>

              <div className="status-card my-stats">
                <p>用户ID：{toTenDigitId(user.id)}</p>
                <p>个人签名：{user.partnerExpectation || "做一个有趣的人"}</p>
                <p>会员状态：{isMembershipValid ? "有效会员" : "免费用户"}</p>
              </div>

              <h3 className="section-title">我的动态</h3>
              <div className="post-composer">
                <input
                  placeholder="写点什么，发布到我的动态..."
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                />
                <button type="button" onClick={publishMyPost}>
                  发布动态
                </button>
              </div>
              <div className="my-post-list">
                {myPosts.length === 0 && <p className="feed-tip">你还没有发布动态</p>}
                {myPosts.map((post) => (
                  <div className="post dark-post" key={post.id}>
                    <p>{post.text}</p>
                    <small>
                      {post.createdAt} · 点赞 {post.likes}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {message && tab !== "chat" && !(tab === "planet-match" && planetMatchLoading) && (
        <p className="msg">{message}</p>
      )}
      {showAddFriendModal && (
        <div className="profile-setup-overlay" onClick={() => setShowAddFriendModal(false)}>
          <div className="profile-setup-card add-friend-card" onClick={(e) => e.stopPropagation()}>
            <h3>添加通讯录好友</h3>
            <p>按昵称、手机号、10位用户ID 搜索全部用户。</p>
            <div className="add-friend-search-row">
              <input
                placeholder="搜索昵称 / 手机号 / 10位用户ID"
                value={addFriendKeyword}
                onChange={(e) => setAddFriendKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRunAddFriendSearch();
                }}
              />
              <button type="button" onClick={onRunAddFriendSearch}>
                搜索
              </button>
            </div>
            {incomingRequests.length > 0 && (
              <div className="add-friend-requests">
                <p>待处理好友请求</p>
                {incomingRequests.map((req) => (
                  <div className="contact-item" key={`req-${req.id}`}>
                    <img src={resolveAssetUrl(req.avatar)} alt={req.name} className="chat-avatar" />
                    <div className="contact-main">
                      <strong>{req.name}</strong>
                      <span>{req.currentCity ? `${req.currentCity} · 在线` : "在线"}</span>
                      <span>ID: {req.uid10}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await respondFriendRequest(req.id, "ACCEPT");
                        } catch (error) {
                          setChatNotice(error.message || "处理好友请求失败");
                        }
                      }}
                    >
                      同意
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await respondFriendRequest(req.id, "REJECT");
                        } catch (error) {
                          setChatNotice(error.message || "处理好友请求失败");
                        }
                      }}
                    >
                      拒绝
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="add-friend-list">
              {addFriendKeyword.trim() && addFriendCandidates.length === 0 && <p className="feed-tip">没有匹配到可添加用户</p>}
              {addFriendCandidates.map((item) => (
                <div className="contact-item" key={`add-${item.id}`}>
                  <img src={resolveAssetUrl(item.avatar)} alt={item.name} className="chat-avatar" />
                  <div className="contact-main">
                    <strong>{item.name}</strong>
                    <span>{item.currentCity ? `${item.currentCity} · 在线` : "在线"}</span>
                    <span>ID: {item.uid10 || toTenDigitId(item.id)}</span>
                  </div>
                  {item.isFriend ? (
                    <button type="button" disabled>
                      已是好友
                    </button>
                  ) : item.requestStatus === "PENDING" && item.requestDirection === "OUTGOING" ? (
                    <button
                      type="button"
                      onClick={() => setChatNotice("申请已发送，等对方在 + 里同意即可")}
                    >
                      已发送
                    </button>
                  ) : item.requestStatus === "PENDING" && item.requestDirection === "INCOMING" ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await respondFriendRequest(item.requestId, "ACCEPT");
                        } catch (error) {
                          setChatNotice(error.message || "处理好友请求失败");
                        }
                      }}
                    >
                      通过
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await sendFriendRequest(item.id, item.name);
                        } catch (error) {
                          setChatNotice(error.message || "发起好友请求失败");
                        }
                      }}
                    >
                      添加
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowAddFriendModal(false)}>
              关闭
            </button>
          </div>
        </div>
      )}

      {showWerewolfModal && (
        <div className="profile-setup-overlay" onClick={closeWerewolfModal}>
          <div className="profile-setup-card werewolf-card" onClick={(e) => e.stopPropagation()}>
            <div className="game-modal-head">
              <h3>狼人杀</h3>
              <button type="button" className="sound-toggle-btn" onClick={toggleGameSfx}>
                音效{gameSfxEnabled ? "开" : "关"}
              </button>
            </div>
            {werewolfMode === "menu" && (
              <div className="werewolf-mode-wrap">
                <div className="werewolf-menu">
                  <button type="button" onClick={enterWerewolfMatch}>
                    多人匹配
                  </button>
                  <button type="button" onClick={enterWerewolfRoom}>
                    好友房邀请
                  </button>
                </div>
                {werewolfInvitations.length > 0 && (
                  <div className="werewolf-invite-list">
                    {werewolfInvitations.map((item) => (
                      <div key={`ww-invite-${item.roomId}`} className="contact-item">
                        <img src={resolveAssetUrl(item.ownerAvatar)} alt={item.ownerName} className="chat-avatar" />
                        <div className="contact-main">
                          <strong>{item.ownerName}</strong>
                          <span>邀请你加入狼人杀好友房</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            enterWerewolfInvitationRoom(item.roomId).catch((e) =>
                              setChatNotice(e.message || "进入房间失败")
                            )
                          }
                        >
                          进入
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {werewolfMode === "match" && (
              <div className="werewolf-mode-wrap">
                <p>多人匹配模式（固定6人）</p>
                <p className="feed-tip">
                  {isWerewolfMatching ? "匹配中，请稍候..." : "点击下方按钮进入狼人等待匹配"}
                </p>
                <button type="button" onClick={startWerewolfMatching} disabled={isWerewolfMatching}>
                  {isWerewolfMatching ? "匹配中..." : "开始匹配"}
                </button>
                <button type="button" onClick={() => setWerewolfMode("menu")}>
                  菜单
                </button>
              </div>
            )}
            {werewolfMode === "room" && (
              <div className="werewolf-mode-wrap">
                <p>
                  好友房（{werewolfRoomMembers.length}/12） · 已同意 {acceptedMemberCount} 人
                </p>
                <div className="werewolf-seats">
                  {Array.from({ length: 12 }, (_, idx) => {
                    const member = werewolfRoomMembers[idx];
                    return (
                      <div key={`seat-${idx + 1}`} className={`seat ${member ? "filled" : ""}`}>
                        <strong>{`#${idx + 1}`}</strong>
                        <span>{member ? member.name : "空位"}</span>
                        {member && !member.owner && <button type="button">{member.status || "PENDING"}</button>}
                      </div>
                    );
                  })}
                </div>
                {showWerewolfInvitePanel && (
                  <div className="werewolf-invite-list">
                    {contacts.map((item) => {
                      const member = werewolfRoomMembers.find((m) => m.id === item.id);
                      const cooldownLeft = Math.max(
                        0,
                        Math.ceil((Number(werewolfInviteCooldowns[item.id] || 0) - Date.now()) / 1000)
                      );
                      const roomFull = invitedMemberCount >= 11;
                      const disabled = roomFull || Boolean(member) || cooldownLeft > 0;
                      let label = "邀请";
                      if (member?.status === "PENDING") label = "已邀请";
                      else if (member?.status === "ACCEPTED") label = "已同意";
                      else if (cooldownLeft > 0) label = `已邀请(${cooldownLeft}s)`;
                      else if (roomFull) label = "已满";
                      return (
                        <div key={`invite-${item.id}`} className="contact-item">
                          <img src={resolveAssetUrl(item.avatar)} alt={item.name} className="chat-avatar" />
                          <div className="contact-main">
                            <strong>{item.name}</strong>
                            <span>{item.status}</span>
                          </div>
                          <button type="button" disabled={disabled} onClick={() => inviteWerewolfFriend(item)}>
                            {label}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  disabled={acceptedMemberCount < 6}
                  onClick={startWerewolfRoomGame}
                >
                  {acceptedMemberCount < 6 ? "至少6名玩家同意后开始" : "开始游戏"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ensureWerewolfFriendRoom().catch((e) => setChatNotice(e.message));
                    setShowWerewolfInvitePanel((prev) => !prev);
                  }}
                >
                  {showWerewolfInvitePanel ? "收起邀请列表" : "邀请好友"}
                </button>
                {currentWerewolfMember && !currentWerewolfMember.owner && !currentWerewolfMember.accepted && (
                  <div className="werewolf-menu">
                    <button
                      type="button"
                      onClick={() => respondWerewolfInvite("ACCEPT").catch((e) => setChatNotice(e.message))}
                    >
                      同意邀请
                    </button>
                    <button
                      type="button"
                      onClick={() => respondWerewolfInvite("DECLINE").catch((e) => setChatNotice(e.message))}
                    >
                      拒绝邀请
                    </button>
                  </div>
                )}
              </div>
            )}
            {werewolfMode === "playing" && werewolfGame && (
              <div className="werewolf-mode-wrap werewolf-judge-sheet">
                {werewolfIntroCountdown > 0 && <div className="game-intro-overlay">{werewolfIntroCountdown}</div>}
                {werewolfFxText && <div className="game-fx-toast">{werewolfFxText}</div>}
                <div className="game-hud-row">
                  <span className="game-pill">存活 {werewolfAliveCount}/{werewolfTotalCount || 0}</span>
                  <span className={`game-pill ${werewolfGame.phase === "NIGHT" ? "danger" : "safe"}`}>
                    {werewolfGame.phase === "NIGHT" ? "夜晚博弈" : werewolfGame.phase === "DAY_SPEECH" ? "白天发言" : "白天投票"}
                  </span>
                </div>
                <p>
                  第 {werewolfGame.day} 天 · {werewolfGame.phase === "NIGHT" ? "夜晚阶段" : werewolfGame.phase === "DAY_SPEECH" ? "白天发言" : werewolfGame.phase === "DAY_VOTE" ? "白天投票" : "游戏结束"}
                </p>
                <p className="feed-tip">
                  你的身份：{werewolfGame.myRole || "未知"}
                  {werewolfGame.winner ? ` · 胜利阵营：${werewolfGame.winner === "WOLF" ? "狼人" : "好人"}` : ""}
                </p>
                {werewolfGame.phase === "DAY_SPEECH" && !werewolfGame.winner && (
                  <p className="feed-tip">
                    发言倒计时：{Math.max(0, werewolfSpeechCountdown || Number(werewolfGame.speechSecondsLeft || 0))}s
                  </p>
                )}
                <div className="werewolf-role-grid">
                  {werewolfGame.players.map((item) => (
                    <span key={`ww-player-${item.userId}`}>
                      {item.name} · {item.alive ? "存活" : "出局"}
                      {item.role ? ` · ${item.role}` : ""}
                    </span>
                  ))}
                </div>
                <div className="werewolf-script-list">
                  {werewolfGame.logs.map((line) => (
                    <p key={line.id}>{line.text}</p>
                  ))}
                </div>
                {werewolfGame.actions?.canNightKill && (
                  <div className="werewolf-menu">
                    {werewolfGame.actions.allowedTargets.map((item) => (
                      <button
                        key={`kill-${item.userId}`}
                        type="button"
                        disabled={werewolfActionLoading}
                        onClick={() => submitWerewolfAction({ type: "night-kill", targetUserId: item.userId })}
                      >
                        夜杀 {item.name}
                      </button>
                    ))}
                  </div>
                )}
                {werewolfGame.actions?.canSpeak && (
                  <div className="werewolf-menu">
                    <input
                      value={werewolfSpeechDraft}
                      onChange={(e) => setWerewolfSpeechDraft(e.target.value)}
                      placeholder="输入你的发言"
                    />
                    <button
                      type="button"
                      disabled={werewolfActionLoading}
                      onClick={() => submitWerewolfAction({ type: "speak", text: werewolfSpeechDraft })}
                    >
                      提交发言
                    </button>
                  </div>
                )}
                {werewolfGame.actions?.canVote && (
                  <div className="werewolf-menu">
                    {werewolfGame.actions.allowedTargets.map((item) => (
                      <button
                        key={`vote-${item.userId}`}
                        type="button"
                        disabled={werewolfActionLoading}
                        onClick={() => submitWerewolfAction({ type: "vote", targetUserId: item.userId })}
                      >
                        投票 {item.name}
                      </button>
                    ))}
                  </div>
                )}
                {!werewolfGame.winner && !werewolfGame.actions?.canNightKill && !werewolfGame.actions?.canSpeak && !werewolfGame.actions?.canVote && (
                  <p className="feed-tip">等待其他玩家行动中...</p>
                )}
              </div>
            )}
            {werewolfMode === "playing" && !werewolfGame && (
              <div className="werewolf-mode-wrap">
                <p>正在进入游戏房间...</p>
                <p className="feed-tip">正在同步对局状态，请稍候 1-2 秒。</p>
                <button type="button" onClick={() => refreshWerewolfRoom().catch((e) => setChatNotice(e.message))}>
                  立即重试
                </button>
              </div>
            )}
            {werewolfMode === "judge" && werewolfRulePack && (
              <div className="werewolf-mode-wrap werewolf-judge-sheet">
                <p>
                  法官一页纸 · {werewolfRulePack.modeLabel} · {werewolfRulePack.count}人局
                </p>
                <div className="werewolf-role-grid">
                  <span>狼人 x {werewolfRulePack.role.wolf}</span>
                  <span>预言家 x {werewolfRulePack.role.seer}</span>
                  <span>女巫 x {werewolfRulePack.role.witch}</span>
                  <span>猎人 x {werewolfRulePack.role.hunter}</span>
                  <span>白痴 x {werewolfRulePack.role.idiot}</span>
                  <span>平民 x {werewolfRulePack.role.villager}</span>
                </div>
                <p>统一规则：{werewolfRulePack.baseRule}</p>
                <p>补充规则：女巫不能自救/一晚一药；猎人被毒不能开枪；白痴翻牌免死且失去投票权。</p>
                <div className="werewolf-script-list">
                  {werewolfRulePack.script.map((line, idx) => (
                    <p key={`script-${idx}`}>{idx + 1}. {line}</p>
                  ))}
                </div>
                <button type="button" onClick={startWerewolfRoomGame}>
                  确认开局
                </button>
                <button type="button" onClick={() => setWerewolfMode("menu")}>
                  返回菜单
                </button>
              </div>
            )}
            <button type="button" onClick={closeWerewolfModal}>
              关闭
            </button>
          </div>
        </div>
      )}

      {showTacitModal && (
        <div className="profile-setup-overlay" onClick={closeTacitModal}>
          <div className="profile-setup-card werewolf-card tacit-card" onClick={(e) => e.stopPropagation()}>
            <div className="game-modal-head">
              <h3>二选一默契挑战</h3>
              <button type="button" className="sound-toggle-btn" onClick={toggleGameSfx}>
                音效{gameSfxEnabled ? "开" : "关"}
              </button>
            </div>
            {tacitMode === "menu" && (
              <div className="werewolf-mode-wrap">
                <p>每局 10 题，同一个答案 +10 分，用来测你们的默契值。</p>
                <div className="werewolf-menu">
                  <button type="button" onClick={startTacitMatch}>
                    匹配
                  </button>
                  <button type="button" onClick={() => setTacitMode("invite")}>
                    邀请好友
                  </button>
                </div>
                {tacitInvitations.length > 0 && (
                  <div className="werewolf-invite-list">
                    {tacitInvitations.map((item) => (
                      <div key={`tacit-invite-${item.roomId}`} className="contact-item">
                        <img src={resolveAssetUrl(item.ownerAvatar)} alt={item.ownerName} className="chat-avatar" />
                        <div className="contact-main">
                          <strong>{item.ownerName}</strong>
                          <span>邀请你加入二选一默契挑战</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            enterTacitInvitationRoom(item.roomId).catch((e) =>
                              setChatNotice(e.message || "进入房间失败")
                            )
                          }
                        >
                          进入
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tacitMode === "match" && (
              <div className="werewolf-mode-wrap">
                <p>匹配模式（2人）</p>
                <p className="feed-tip">{isTacitMatching ? "匹配中，请稍候..." : "点击按钮开始匹配"}</p>
                <button type="button" onClick={startTacitMatch} disabled={isTacitMatching}>
                  {isTacitMatching ? "匹配中..." : "开始匹配"}
                </button>
                <button type="button" onClick={() => setTacitMode("menu")}>
                  菜单
                </button>
              </div>
            )}
            {tacitMode === "invite" && (
              <div className="werewolf-mode-wrap">
                <p>选择一个好友开始 10 题默契挑战</p>
                <div className="werewolf-invite-list">
                  {contacts.map((item) => (
                    <div key={`tacit-${item.id}`} className="contact-item">
                      <img src={resolveAssetUrl(item.avatar)} alt={item.name} className="chat-avatar" />
                      <div className="contact-main">
                        <strong>{item.name}</strong>
                        <span>{item.status}</span>
                      </div>
                      <button type="button" onClick={() => inviteTacitFriend(item)}>
                        邀请
                      </button>
                    </div>
                  ))}
                  {contacts.length === 0 && <p className="feed-tip">通讯录暂无好友，先去添加好友吧</p>}
                </div>
                <button type="button" onClick={() => setTacitMode("menu")}>
                  返回菜单
                </button>
              </div>
            )}
            {tacitMode === "room" && tacitRoom && (
              <div className="werewolf-mode-wrap">
                <p>好友房（已同意 {tacitRoom.acceptedCount || 0}/2）</p>
                <div className="werewolf-seats">
                  {Array.from({ length: 2 }, (_, idx) => {
                    const member = tacitRoom.members[idx];
                    return (
                      <div key={`tacit-seat-${idx + 1}`} className={`seat ${member ? "filled" : ""}`}>
                        <strong>{`#${idx + 1}`}</strong>
                        <span>{member ? member.name : "空位"}</span>
                        {member && member.userId !== user?.id && <span>{member.status}</span>}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={(tacitRoom.acceptedCount || 0) < 2}
                  onClick={() => startTacitRoomGame().catch((e) => setChatNotice(e.message || "开始失败"))}
                >
                  {(tacitRoom.acceptedCount || 0) < 2 ? "需要2名玩家同意" : "开始挑战"}
                </button>
                {tacitRoom.members.some((m) => m.userId === user?.id && m.status === "PENDING") && (
                  <div className="werewolf-menu">
                    <button
                      type="button"
                      onClick={() => respondTacitInvite("ACCEPT").catch((e) => setChatNotice(e.message))}
                    >
                      同意邀请
                    </button>
                    <button
                      type="button"
                      onClick={() => respondTacitInvite("DECLINE").catch((e) => setChatNotice(e.message))}
                    >
                      拒绝邀请
                    </button>
                  </div>
                )}
              </div>
            )}
            {tacitMode === "playing" && tacitCurrentQuestion && (
              <div className="werewolf-mode-wrap">
                {tacitIntroCountdown > 0 && <div className="game-intro-overlay">{tacitIntroCountdown}</div>}
                {tacitFxText && <div className="game-fx-toast">{tacitFxText}</div>}
                <div className="game-progress-wrap">
                  <div className="game-progress-label">
                    <span>默契进度</span>
                    <strong>{tacitProgressPercent}%</strong>
                  </div>
                  <div className="game-progress-bar">
                    <span style={{ width: `${tacitProgressPercent}%` }} />
                  </div>
                </div>
                <p>
                  第 {Number(tacitCurrentQuestion.sortOrder || 0) + 1} / {tacitRoom?.questionCount || 10} 题 · 当前默契值{" "}
                  {tacitRoom?.score || 0}
                </p>
                <p className="feed-tip">本题剩余作答时间：{tacitCountdownSec}s</p>
                <p className="tacit-question-title">{tacitCurrentQuestion.prompt}</p>
                <div className="tacit-answer-grid">
                  <div className="tacit-answer-card">
                    <strong>{user?.nickname || "我"}</strong>
                    <button
                      type="button"
                      className={tacitDisplayChoice === "A" ? "active-choice" : ""}
                      disabled={tacitHasSubmitted}
                      onClick={() => setTacitDraftChoice("A")}
                    >
                      A. {tacitCurrentQuestion.optionA}
                    </button>
                    <button
                      type="button"
                      className={tacitDisplayChoice === "B" ? "active-choice" : ""}
                      disabled={tacitHasSubmitted}
                      onClick={() => setTacitDraftChoice("B")}
                    >
                      B. {tacitCurrentQuestion.optionB}
                    </button>
                    <button
                      type="button"
                      disabled={tacitHasSubmitted || !tacitDraftChoice || tacitConfirming}
                      onClick={() => confirmTacitAnswer().catch((e) => setChatNotice(e.message || "提交失败"))}
                    >
                      {tacitHasSubmitted ? "已确认" : tacitConfirming ? "确认中..." : "确认"}
                    </button>
                  </div>
                  <div className="tacit-answer-card">
                    <strong>{tacitPeerDisplay?.name || "对方"}</strong>
                    <p className="feed-tip">
                      {tacitPeerMember && tacitCurrentQuestion.choices?.[tacitPeerMember.userId] ? "已作答" : "等待对方作答"}
                    </p>
                  </div>
                </div>
                {tacitCurrentQuestion.done && (
                  <p className="feed-tip">{tacitCurrentQuestion.matched ? "本题默契+10" : "本题未加分"}</p>
                )}
                {!tacitCurrentQuestion.done && <p className="feed-tip">双方确认后自动进入下一题</p>}
              </div>
            )}
            {tacitMode === "result" && tacitRoom && (
              <div className="werewolf-mode-wrap">
                <p>挑战完成</p>
                <h4 className="tacit-score">默契值：{tacitRoom.score || 0} / 100</h4>
                <div className={`result-rank-chip ${(tacitRoom.score || 0) >= 80 ? "gold" : (tacitRoom.score || 0) >= 50 ? "silver" : "bronze"}`}>
                  {(tacitRoom.score || 0) >= 80 ? "王者默契" : (tacitRoom.score || 0) >= 50 ? "进阶默契" : "新手默契"}
                </div>
                <p className="feed-tip">
                  {(tacitRoom.score || 0) >= 80
                    ? "默契爆表，简直心有灵犀！"
                    : (tacitRoom.score || 0) >= 50
                      ? "默契不错，再玩几局会更合拍。"
                      : "默契值还有提升空间，继续互相了解吧。"}
                </p>
                {tacitPeerMember && (
                  <div className="contact-item">
                    <img
                      src={resolveAssetUrl(tacitPeerDisplay?.avatar || tacitPeerMember.avatar)}
                      alt={tacitPeerDisplay?.name || tacitPeerMember.name}
                      className="chat-avatar"
                    />
                    <div className="contact-main">
                      <strong>{tacitPeerDisplay?.name || tacitPeerMember.name || "对方玩家"}</strong>
                      <span>本局对手 · 点击可添加好友</span>
                    </div>
                    <button type="button" onClick={() => onTacitAddFriend()}>
                      添加
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => inviteTacitReplay()}>
                  邀请再来一局
                </button>
                <button type="button" onClick={() => rematchTacitRound()}>
                  重新匹配
                </button>
                <button type="button" onClick={() => setTacitMode("menu")}>
                  返回菜单
                </button>
              </div>
            )}
            <button type="button" onClick={closeTacitModal}>
              关闭
            </button>
          </div>
        </div>
      )}

      {showSentenceModal && (
        <div className="profile-setup-overlay" onClick={closeSentenceModal}>
          <div className="profile-setup-card werewolf-card tacit-card" onClick={(e) => e.stopPropagation()}>
            <div className="game-modal-head">
              <h3>猜句子接龙</h3>
              <button type="button" className="sound-toggle-btn" onClick={toggleGameSfx}>
                音效{gameSfxEnabled ? "开" : "关"}
              </button>
            </div>
            {sentenceMode === "menu" && (
              <div className="werewolf-mode-wrap">
                <p>每局 5 题，双方从同一句开头里选下一句，选中同一个选项即加分。</p>
                <div className="werewolf-menu">
                  <button type="button" onClick={startSentenceMatch}>
                    匹配模式
                  </button>
                  <button type="button" onClick={() => setSentenceMode("invite")}>
                    邀请好友
                  </button>
                </div>
              </div>
            )}
            {sentenceMode === "match" && (
              <div className="werewolf-mode-wrap">
                <p>句子接龙匹配中（2人）</p>
                <p className="feed-tip">{isSentenceMatching ? "正在为你匹配同频玩家..." : "点击按钮开始匹配"}</p>
                <button type="button" onClick={startSentenceMatch} disabled={isSentenceMatching}>
                  {isSentenceMatching ? "匹配中..." : "开始匹配"}
                </button>
                <button type="button" onClick={() => setSentenceMode("menu")}>
                  返回菜单
                </button>
              </div>
            )}
            {sentenceMode === "invite" && (
              <div className="werewolf-mode-wrap">
                <p>邀请好友进入接龙局</p>
                <div className="werewolf-invite-list">
                  {contacts.length ? (
                    contacts.map((item) => (
                      <div key={`sentence-invite-${item.id}`} className="contact-item">
                        <img src={resolveAssetUrl(item.avatar)} alt={item.name} className="chat-avatar" />
                        <div className="contact-main">
                          <strong>{item.name}</strong>
                          <span>{item.status}</span>
                        </div>
                        <button type="button" onClick={() => startSentenceInviteGame(item)}>
                          开始
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="feed-tip">暂无可邀请好友，先去聊天页加好友吧。</p>
                  )}
                </div>
                <button type="button" onClick={() => setSentenceMode("menu")}>
                  返回菜单
                </button>
              </div>
            )}
            {sentenceMode === "playing" && sentenceCurrentRound && (
              <div className="werewolf-mode-wrap">
                {sentenceIntroCountdown > 0 && <div className="game-intro-overlay">{sentenceIntroCountdown}</div>}
                {sentenceFxText && <div className="game-fx-toast">{sentenceFxText}</div>}
                <div className="game-progress-wrap">
                  <div className="game-progress-label">
                    <span>接龙进度</span>
                    <strong>{sentenceProgressPercent}%</strong>
                  </div>
                  <div className="game-progress-bar">
                    <span style={{ width: `${sentenceProgressPercent}%` }} />
                  </div>
                </div>
                <p>
                  第 {sentenceRoundIndex + 1} / {sentenceRounds.length} 题 · {sentenceOpponent?.name || "对方"}
                </p>
                <p className="feed-tip">本题倒计时：{sentenceCountdown}s</p>
                <div className="sentence-round-card">
                  <strong>{sentenceCurrentRound.stem}</strong>
                  <div className="sentence-options">
                    {sentenceCurrentRound.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={sentenceMyChoice === option ? "active-choice" : ""}
                        disabled={Boolean(sentenceMyChoice) || sentenceResolving}
                        onClick={() => pickSentenceChoice(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                {sentenceMyChoice && (
                  <p className="feed-tip">
                    你选择：{sentenceMyChoice}
                    {sentencePeerChoice ? ` ｜ 对方选择：${sentencePeerChoice}` : " ｜ 等待对方选择..."}
                  </p>
                )}
                <p className="feed-tip">当前默契分：{sentenceScore}</p>
              </div>
            )}
            {sentenceMode === "result" && (
              <div className="werewolf-mode-wrap">
                <p>本局完成：默契分 {sentenceScore} / 100</p>
                <div className={`result-rank-chip ${sentenceScore >= 80 ? "gold" : sentenceScore >= 50 ? "silver" : "bronze"}`}>
                  {sentenceScore >= 80 ? "灵魂同频" : sentenceScore >= 50 ? "默契在线" : "继续磨合"}
                </div>
                <div className="werewolf-script-list">
                  {sentenceLogs.map((line, idx) => (
                    <p key={`sentence-log-${idx}`}>{line}</p>
                  ))}
                </div>
                <div className="werewolf-menu">
                  <button type="button" onClick={startSentenceMatch}>
                    再来一局
                  </button>
                  <button type="button" onClick={() => setSentenceMode("menu")}>
                    返回菜单
                  </button>
                </div>
              </div>
            )}
            <button type="button" onClick={closeSentenceModal}>
              关闭
            </button>
          </div>
        </div>
      )}
      {showMembershipGate && (
        <div className="profile-setup-overlay membership-gate-overlay" onClick={() => setShowMembershipGate(false)}>
          <div className="profile-setup-card membership-gate-card" onClick={(e) => e.stopPropagation()}>
            <div className="membership-sheet-handle" aria-hidden="true" />
            <h3>{membershipGateCopy.title}</h3>
            <p>{membershipGateCopy.desc}</p>
            <div className="werewolf-menu">
              <button type="button" disabled={membershipSubmitting} onClick={() => subscribeMembership("MONTH")}>
                月卡 ¥29
              </button>
              <button type="button" disabled={membershipSubmitting} onClick={() => subscribeMembership("QUARTER")}>
                季卡 ¥79
              </button>
              <button type="button" disabled={membershipSubmitting} onClick={() => subscribeMembership("YEAR")}>
                年卡 ¥269
              </button>
            </div>
            <button type="button" onClick={() => setShowMembershipGate(false)}>
              {membershipGateCopy.cancel}
            </button>
          </div>
        </div>
      )}

      {showTruthModal && (
        <div className="profile-setup-overlay" onClick={closeTruthModal}>
          <div className="profile-setup-card truth-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="game-modal-head">
              <h3>真心话挑战</h3>
              <button type="button" className="sound-toggle-btn" onClick={toggleGameSfx}>
                音效{gameSfxEnabled ? "开" : "关"}
              </button>
            </div>
            {truthMode === "menu" && (
              <div className="werewolf-mode-wrap">
                <p>本局题目风格</p>
                <div className="sentence-options">
                  {TRUTH_DIFFICULTY_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={truthDifficulty === item.id ? "active-choice" : ""}
                      onClick={() => setTruthDifficulty(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="werewolf-menu">
                  <button type="button" onClick={startTruthMatch}>
                    匹配模式
                  </button>
                  <button type="button" onClick={openTruthInviteRoom}>
                    邀请模式
                  </button>
                </div>
              </div>
            )}
            {truthMode === "match" && <p>{isTruthMatching ? "正在匹配异性用户..." : "匹配完成，即将进入挑战"}</p>}
            {truthMode === "invite" && (
              <div className="werewolf-mode-wrap">
                <p>邀请房间（实时状态）</p>
                <div className="werewolf-script-list truth-invite-list">
                  {truthInviteMembers.map((member) => (
                    <div key={`truth-member-${member.userId}`} className="werewolf-member-item">
                      <span>{member.name}</span>
                      <small>
                        {member.status === "HOST" ? "房主" : member.status === "ACCEPTED" ? "已接受" : "待接受"}
                      </small>
                    </div>
                  ))}
                </div>
                <div className="werewolf-script-list truth-invite-list">
                  {contacts.length ? (
                    contacts.slice(0, 8).map((friend) => {
                      const member = truthInviteMembers.find((item) => item.userId === friend.id);
                      return (
                        <div key={`truth-invite-${friend.id}`} className="werewolf-member-item">
                          <span>{friend.name}</span>
                          {member ? (
                            <small>{member.status === "ACCEPTED" ? "已接受" : "已邀请"}</small>
                          ) : (
                            <button type="button" onClick={() => startTruthInvite(friend)}>
                              邀请
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p>暂无可邀请好友，先去聊天页添加好友吧。</p>
                  )}
                </div>
                <button type="button" onClick={startTruthInviteRoomGame}>
                  开始挑战
                </button>
              </div>
            )}
            {truthMode === "playing" && (
              <div className={`werewolf-mode-wrap truth-round-panel ${truthRoundAnimating ? "round-enter" : ""}`}>
                <p>
                  对手：{truthOpponent?.name || "隐藏款"} · 本局共 {TRUTH_ROUNDS_PER_GAME} 回合，系统自动摇骰子与出题。
                </p>
                <div className="truth-phase-stepper">
                  {truthPhaseSteps.map((step, idx) => (
                    <span
                      key={step.id}
                      className={`${truthPhase === step.id ? "active" : ""} ${idx < truthPhaseIndex ? "done" : ""}`}
                    >
                      {step.label}
                    </span>
                  ))}
                </div>
                <p className="feed-tip">
                  题目风格：{TRUTH_DIFFICULTY_OPTIONS.find((item) => item.id === truthDifficulty)?.label || "轻松"}
                  {truthDifficulty === "MIXED" ? "（每回合随机）" : ""} · 当前进行：第{" "}
                  {Math.max(1, truthRoundIndex)} / {TRUTH_ROUNDS_PER_GAME} 回合
                </p>
                <div className={`truth-dice-board ${truthIsRolling ? "rolling" : ""} ${truthDiceSettling ? "settling" : ""}`}>
                  <div className="truth-dice-cell">
                    <span className="truth-dice-face" aria-hidden="true">
                      {getDiceFace(truthRollingDice.me)}
                    </span>
                    <span>你：{truthRollingDice.me} 点</span>
                  </div>
                  <div className="truth-dice-cell">
                    <span className="truth-dice-face" aria-hidden="true">
                      {getDiceFace(truthRollingDice.peer)}
                    </span>
                    <span>对方：{truthRollingDice.peer} 点</span>
                  </div>
                </div>
                {truthIsRolling && <p className="feed-tip">骰子滚动中...</p>}
                {truthPhase === "pick" && !truthIsRolling && (
                  <div className="werewolf-mode-wrap">
                    <p className="feed-tip">
                      {truthDiceResult?.meLose ? `对方选题中（剩余 ${truthPhaseCountdown}s）` : `请选择 1 个问题（剩余 ${truthPhaseCountdown}s）`}
                    </p>
                    <div className="truth-phase-progress">
                      <span style={{ width: `${Math.max(0, Math.min(100, (truthPhaseCountdown / 8) * 100))}%` }} />
                    </div>
                    {!truthDiceResult?.meLose && (
                      <div className="truth-question-cards">
                        {truthQuestionOptions.map((item, idx) => (
                          <button
                            key={`truth-q-${idx}`}
                            type="button"
                            className={truthPickedQuestionIndex === idx ? "picked" : ""}
                            onClick={() => chooseTruthQuestion(idx)}
                            disabled={truthPickedQuestionIndex >= 0}
                          >
                            <span className="truth-question-index">问题 {idx + 1}</span>
                            <span>{item.question}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!truthIsRolling && truthCurrentQuestion && (
                  <div className="werewolf-script-list">
                    <p>题目（{truthCurrentDifficultyLabel}）：{truthCurrentQuestion}</p>
                  </div>
                )}
                {truthPhase === "answer" && truthAwaitingMyAnswer && !truthIsRolling && (
                  <div className="werewolf-mode-wrap">
                    <p className="feed-tip">你的作答时间：{truthPhaseCountdown}s</p>
                    <div className="truth-phase-progress">
                      <span style={{ width: `${Math.max(0, Math.min(100, (truthPhaseCountdown / 12) * 100))}%` }} />
                    </div>
                    <textarea
                      className="truth-answer-input"
                      value={truthAnswerDraft}
                      onChange={(e) => setTruthAnswerDraft(e.target.value)}
                      placeholder="这一回合你点数更低，请输入你的真心话回答"
                      maxLength={120}
                    />
                    <p className="feed-tip">至少输入 {truthAnswerMinLen} 个字再提交</p>
                    <button type="button" onClick={submitTruthAnswer} disabled={truthAnswerDraft.trim().length < truthAnswerMinLen}>
                      提交我的回答
                    </button>
                  </div>
                )}
                {truthPhase === "answer" && !truthAwaitingMyAnswer && !truthIsRolling && truthDiceResult && (
                  <>
                    <p className="feed-tip">对方作答中（剩余 {truthPhaseCountdown}s）...</p>
                    <div className="truth-phase-progress">
                      <span style={{ width: `${Math.max(0, Math.min(100, (truthPhaseCountdown / 10) * 100))}%` }} />
                    </div>
                  </>
                )}
                {truthPhase === "review" && (
                  <>
                    <p className="feed-tip">答案已提交，对方查看中（{truthPhaseCountdown}s）...</p>
                    <div className="truth-phase-progress">
                      <span style={{ width: `${Math.max(0, Math.min(100, (truthPhaseCountdown / 3) * 100))}%` }} />
                    </div>
                  </>
                )}
              </div>
            )}
            {truthMode === "result" && (
              <div className="werewolf-mode-wrap">
                <p>本局已完成 {TRUTH_ROUNDS_PER_GAME} / {TRUTH_ROUNDS_PER_GAME} 回合</p>
                {truthDiceResult && (
                  <p>
                    最后一回合骰子：你 {truthDiceResult.me} 点 / 对方 {truthDiceResult.peer} 点
                  </p>
                )}
                <div className="werewolf-script-list">
                  {truthLogs.map((line, idx) => (
                    <p key={`truth-log-${idx}`}>{line}</p>
                  ))}
                </div>
                <div className="werewolf-menu">
                  <button type="button" onClick={handleTruthProfileGate}>
                    查看对方资料
                  </button>
                  <button type="button" onClick={handleTruthContact}>
                    联系对方
                  </button>
                </div>
                <button type="button" onClick={() => setTruthMode("menu")}>
                  再来一局
                </button>
              </div>
            )}
            <button type="button" onClick={closeTruthModal}>
              关闭
            </button>
          </div>
        </div>
      )}

      {tab === "planet-match" && (
        <section className="planet-match-page" aria-labelledby="planet-match-main-title">
          <div className="planet-match-page-bg" aria-hidden>
            <div className="planet-match-page-stars" />
            <div className="planet-match-page-aurora" />
            <div className="planet-match-page-rings" />
            <div className="planet-match-page-moon" />
          </div>
          <div className="planet-match-page-inner">
            {planetMatchLoading ? (
              <div className="planet-match-page-loading" aria-busy="true">
                <div className="planet-match-page-hero" aria-hidden>
                  <div className="planet-match-page-ufo">
                    <span className="planet-match-page-ufo-dome" />
                    <span className="planet-match-page-ufo-body" />
                    <span className="planet-match-page-ufo-glow" />
                  </div>
                  <div className="planet-match-page-scene">
                    <div className="planet-match-orbit-solo planet-match-orbit-solo--cosmic">
                      <div className="planet-match-orbit-solo-arm">
                        <span className="planet-match-orbit-dot planet-match-orbit-dot--cyan" />
                      </div>
                    </div>
                    <div className="planet-match-orbit-solo planet-match-orbit-solo--cosmic planet-match-orbit-solo--reverse">
                      <div className="planet-match-orbit-solo-arm planet-match-orbit-solo-arm--tight">
                        <span className="planet-match-orbit-dot planet-match-orbit-dot--magenta" />
                      </div>
                    </div>
                    <div className="planet-match-globe planet-match-globe--cosmic">
                      <span className="planet-match-globe-highlight planet-match-globe-highlight--cosmic" />
                    </div>
                  </div>
                </div>
                <p className="planet-match-page-whisper">星链校准中，为你寻找同频信号</p>
                <h2 id="planet-match-main-title" className="planet-match-page-heading">
                  正在为你匹配隐藏款
                </h2>
                <p className="planet-match-page-caption">
                  {planetMatchWaitHint || "星际巡航中，大约 3～7 秒"}
                </p>
                <div className="planet-match-dots planet-match-dots--cosmic" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : planetMatchProfile ? (
              <div className="planet-match-page-result">
                <h2 id="planet-match-main-title" className="planet-match-page-heading planet-match-page-heading--success">
                  匹配成功
                </h2>
                <article className="planet-match-cyber-card">
                  <div className="planet-match-cyber-card-frame" aria-hidden />
                  <img
                    className="planet-match-cyber-cover"
                    src={resolveAssetUrl(planetMatchProfile.avatar || "")}
                    alt={planetMatchProfile.nickname || "匹配对象"}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = planetMatchProfile.gender === "MALE" ? MALE_SYMBOL_AVATAR : FEMALE_SYMBOL_AVATAR;
                    }}
                  />
                  <div className="planet-match-cyber-meta">
                    <strong>{planetMatchProfile.nickname || blindBoxTarget?.nickname || "隐藏款用户"}</strong>
                    <span>
                      {planetMatchProfile.age || "-"}岁 · {planetMatchProfile.city || "同城"}
                    </span>
                    <small>{isMembershipValid ? planetMatchProfile.hobbies || "这个人很有趣，快去认识TA" : ""}</small>
                  </div>
                  <div className="planet-match-cyber-actions">
                    <button type="button" className="planet-match-cyber-btn planet-match-cyber-btn--ghost" onClick={handlePlanetDetailGate}>
                      查看详细资料
                    </button>
                    <button type="button" className="planet-match-cyber-btn planet-match-cyber-btn--glow" onClick={handlePlanetContact}>
                      联系对方
                    </button>
                  </div>
                </article>
                <button type="button" className="planet-match-page-backlink" onClick={leavePlanetMatchPage}>
                  返回盲盒星球
                </button>
              </div>
            ) : (
              <div className="planet-match-page-empty">
                <p className="planet-match-page-caption">暂无可用匹配资料，请稍后重试。</p>
                <button type="button" className="planet-match-cyber-btn planet-match-cyber-btn--glow" onClick={leavePlanetMatchPage}>
                  返回
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <button className="fab" onClick={() => navigate("/planet")}>
        开盲盒
      </button>

      <nav className="bottom-nav">
        <button className={tab === "planet" ? "active" : ""} onClick={() => navigate("/planet")}>
          盲盒星球
        </button>
        <button className={tab === "square" ? "active" : ""} onClick={() => navigate("/square")}>
          广场
        </button>
        <div className="nav-gap" />
        <button className={tab === "chat" ? "active" : ""} onClick={() => navigate("/chat")}>
          聊天
          {totalUnreadCount > 0 && (
            <span className="nav-unread-badge">{totalUnreadCount > 99 ? "99+" : totalUnreadCount}</span>
          )}
        </button>
        <button className={tab === "me" ? "active" : ""} onClick={() => navigate("/me")}>
          自己
        </button>
      </nav>
    </div>
  );
}
