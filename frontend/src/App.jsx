import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
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
const localAvatarPool = Array.from({ length: 91 }, (_, idx) => ({
  src: `/avatars/avatar-${String(idx + 1).padStart(3, "0")}.jpg`,
  alt: `头像${idx + 1}`
}));

function sampleItems(list, count) {
  return [...list]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

function createHeroAvatars() {
  return sampleItems(localAvatarPool, 5);
}

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

function resolveAssetUrl(url) {
  if (!url) return MALE_SYMBOL_AVATAR;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${API}${url}`;
  return url;
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

export default function App() {
  const [tab, setTab] = useState("planet");
  const [chatMode, setChatMode] = useState("chat");
  const [mePage, setMePage] = useState("home");
  const [meDetailPage, setMeDetailPage] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [agreed, setAgreed] = useState(false);
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [session, setSession] = useState(null);
  const [blindBoxTarget, setBlindBoxTarget] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [onlineCount, setOnlineCount] = useState(200000);
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
  const [myPosts, setMyPosts] = useState([]);
  const [newPostText, setNewPostText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pinnedConversationIds, setPinnedConversationIds] = useState([]);
  const [hiddenConversationIds, setHiddenConversationIds] = useState([]);
  const [swipedConversationId, setSwipedConversationId] = useState("");
  const swipeStartXRef = useRef(0);
  const swipeActiveIdRef = useRef("");
  const hiddenConversationIdsRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStartAtRef = useRef(0);
  const [selectedCover, setSelectedCover] = useState("");
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

  const friendlinessPercent = session?.friendliness ?? 0;
  const profilePhotos = useMemo(() => {
    if (!user?.photoUrls) return [];
    try {
      const parsed = JSON.parse(user.photoUrls);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }, [user]);
  const defaultCover = resolveAssetUrl(profilePhotos[0] || user?.avatarUrl || profileForm.avatarUrl);
  const profileCover = selectedCover || defaultCover;
  const userAvatar = resolveAssetUrl(profilePhotos[0] || user?.avatarUrl || profileForm.avatarUrl);
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
  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unread || 0), 0),
    [conversations]
  );

  const sortConversations = (list, pinnedIds = pinnedConversationIds) =>
    [...list].sort((a, b) => {
      const pinA = pinnedIds.includes(a.id) ? 1 : 0;
      const pinB = pinnedIds.includes(b.id) ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      const timeA = new Date(a.time || 0).getTime() || 0;
      const timeB = new Date(b.time || 0).getTime() || 0;
      return timeB - timeA;
    });
  const authHeaders = useMemo(
    () =>
      authToken
        ? {
            Authorization: `Bearer ${authToken}`
          }
        : {},
    [authToken]
  );

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

  const isMembershipValid = useMemo(() => {
    if (!user?.membershipExpireAt || user.membershipType === "FREE") return false;
    return new Date(user.membershipExpireAt) > new Date();
  }, [user]);

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
    setMessage("短信验证通过，注册成功，请完善资料");
  };

  const onCompleteProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    const { birthYear, birthMonth, birthDay, gender } = profileSetupForm;
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
        birthDate
      })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.message || "资料提交失败");
    setUser(data.user);
    setNeedsProfileSetup(false);
    setMessage("");
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
    setMessage(type === "device" ? "本机号码登录成功" : "微信快捷登录成功");
  };

  const startMatch = async () => {
    if (!user) return;
    const res = await fetch(`${API}/match/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.message || "匹配失败");
    setSession(data.session);
    setBlindBoxTarget(data.targetBlindBox);
    setGameState(null);
    setMessage("匹配成功，开始掷骰子");
  };

  const playRound = async () => {
    if (!session) return;
    const res = await fetch(`${API}/game/dice-round`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.message || "回合失败");
    setGameState(data.result);
    setSession(data.progress);
  };

  const unlockProfile = async () => {
    const res = await fetch(`${API}/match/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, maleUserId: session.maleUserId })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.message || "解锁失败");
    setMessage(`已支付 ${data.amount} 元，解锁成功`);
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

  const saveProfile = () => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            ...profileForm,
            photoUrls: JSON.stringify([
              profileForm.avatarUrl || userAvatar,
              ...profilePhotos.filter((item) => item !== (profileForm.avatarUrl || userAvatar))
            ])
          }
        : prev
    );
    setMePage("home");
    setMessage("资料已更新");
  };

  const switchAccount = () => {
    setUser(null);
    setAuthToken("");
    setNeedsProfileSetup(false);
    setProfileSetupForm(profileSetupInitial);
    setSession(null);
    setBlindBoxTarget(null);
    setGameState(null);
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
    setSession(null);
    setBlindBoxTarget(null);
    setGameState(null);
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
      setMessage("头像上传成功，记得点击保存资料");
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
            <img key={avatar.src} src={avatar.src} alt={avatar.alt} />
          ))}
        </div>
        <p className="hero-text">帮你找到附近灵魂最契合的人</p>

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

  return (
    <div className="main-app">
      {chatNotice && <div className="chat-notice-banner">{chatNotice}</div>}
      {needsProfileSetup && (
        <div className="profile-setup-overlay">
          <form className="profile-setup-card" onSubmit={onCompleteProfile}>
            <h3>完善新用户资料</h3>
            <p>资料仅用于匹配推荐，提交后即可正常使用。</p>
            <div className="birth-select-row">
              <select
                value={profileSetupForm.gender}
                onChange={(e) => setProfileSetupForm((prev) => ({ ...prev, gender: e.target.value }))}
                required
              >
                <option value="">性别</option>
                <option value="MALE">男</option>
                <option value="FEMALE">女</option>
              </select>
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
          </form>
        </div>
      )}
      <header className={`main-header ${tab === "me" ? "me-header" : ""}`}>
        {tab === "me" ? (
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
            <div className="hero-level">Lv.1</div>
            <div className="hero-avatar-wrap">
              <div className="hero-avatar" />
            </div>
            <p className="hero-title">她在等你一起加入</p>
            <button className="hero-action">和她通话</button>
          </div>

          <h3 className="section-title">配对聊天</h3>
          <div className="feature-grid">
            <div className="feature-card blue">
              <h3>盲盒匹配</h3>
              <p>今日剩余 30 次</p>
              <button onClick={startMatch}>开始匹配</button>
            </div>
            <div className="feature-card purple">
              <h3>匿名闪聊</h3>
              <p>猜拳互动真心话</p>
              <button>立即开聊</button>
            </div>
            <div className="feature-card orange">
              <h3>文字闪聊</h3>
              <p>立即找人聊聊</p>
              <button>马上开始</button>
            </div>
          </div>

          <h3 className="section-title">配对玩游戏</h3>
          <div className="game-grid">
            <div className="game-card">
              <h4>碰碰球友</h4>
              <p>15.1万人正在玩</p>
            </div>
            <div className="game-card">
              <h4>蛇蛇大作战</h4>
              <p>5.5万人正在玩</p>
            </div>
            <div className="game-card">
              <h4>脑力配对</h4>
              <p>1.5万人正在玩</p>
            </div>
            <div className="game-card">
              <h4>看谁跳得远</h4>
              <p>6.5万人正在玩</p>
            </div>
          </div>

          <div className="status-card">
            <p>盲盒星球在线：{onlineCount.toLocaleString()} 人</p>
            {blindBoxTarget && <p>已匹配到：{blindBoxTarget.nickname}（资料未解锁）</p>}
            {session && (
              <>
                <button onClick={playRound}>掷骰子进行一回合</button>
                <p>回合数：{session.roundsPlayed} / 5+</p>
                <p>友好度：{friendlinessPercent}%</p>
              </>
            )}
            {gameState && (
              <p>
                骰子 A={gameState.diceA} / B={gameState.diceB}，题目：{gameState.question}
              </p>
            )}
            {session?.isUnlocked && user?.gender === "MALE" && (
              <button onClick={unlockProfile}>支付1.9元解锁女方资料</button>
            )}
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
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`chat-bubble ${String(msg.fromUserId) === String(user.id) ? "me-bubble" : "other-bubble"}`}
                      >
                        {msg.kind === "IMAGE" ? (
                          <img
                            src={`${API}${msg.mediaUrl}`}
                            alt="图片消息"
                            className="chat-image"
                            onClick={() => window.open(`${API}${msg.mediaUrl}`, "_blank")}
                          />
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
                            <audio controls preload="metadata" src={`${API}${msg.mediaUrl}`} />
                            <span>{msg.audioDurationSec ? `${msg.audioDurationSec}s` : "语音"}</span>
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                    ))
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
              <div className="status-card profile-editor-page">
                <div className="profile-editor-avatar-row">
                  <img className="profile-avatar" src={resolveAssetUrl(profileForm.avatarUrl || userAvatar)} alt={user.nickname} />
                  <p>点击保存后将更新资料页封面和头像</p>
                </div>
                <div className="profile-editor">
                  <input
                    placeholder="昵称"
                    value={profileForm.nickname}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, nickname: e.target.value }))}
                  />
                  <label className="upload-avatar-btn">
                    上传头像
                    <input type="file" accept="image/*" onChange={onPickProfileAvatar} hidden />
                  </label>
                  <input
                    placeholder="头像/封面地址（可选）"
                    value={profileForm.avatarUrl}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                  />
                  <input
                    placeholder="当前城市"
                    value={profileForm.currentCity}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, currentCity: e.target.value }))}
                  />
                  <input
                    placeholder="个人签名"
                    value={profileForm.partnerExpectation}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, partnerExpectation: e.target.value }))
                    }
                  />
                  <input
                    placeholder="爱好"
                    value={profileForm.hobbies}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, hobbies: e.target.value }))}
                  />
                  <button onClick={saveProfile}>保存资料</button>
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

      {message && tab !== "chat" && <p className="msg">{message}</p>}
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

      <button className="fab" onClick={() => setTab("planet")}>
        开盲盒
      </button>

      <nav className="bottom-nav">
        <button className={tab === "planet" ? "active" : ""} onClick={() => setTab("planet")}>
          盲盒星球
        </button>
        <button className={tab === "square" ? "active" : ""} onClick={() => setTab("square")}>
          广场
        </button>
        <div className="nav-gap" />
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
          聊天
          {totalUnreadCount > 0 && (
            <span className="nav-unread-badge">{totalUnreadCount > 99 ? "99+" : totalUnreadCount}</span>
          )}
        </button>
        <button className={tab === "me" ? "active" : ""} onClick={() => setTab("me")}>
          自己
        </button>
      </nav>
    </div>
  );
}
