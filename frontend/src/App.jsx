import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
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

const registerInitial = {
  phone: "",
  password: "",
  nickname: "",
  gender: "MALE",
  age: 24,
  height: 170,
  weight: 60,
  hometown: "",
  currentCity: "",
  hobbies: "",
  partnerExpectation: "",
  avatarUrl: "",
  photoUrl: "https://picsum.photos/300/300?blindbox"
};

export default function App() {
  const [tab, setTab] = useState("planet");
  const [chatMode, setChatMode] = useState("chat");
  const [mePage, setMePage] = useState("home");
  const [meDetailPage, setMeDetailPage] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [agreed, setAgreed] = useState(false);
  const [user, setUser] = useState(null);
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
  const [registerForm, setRegisterForm] = useState(registerInitial);
  const [chatKeyword, setChatKeyword] = useState("");
  const [heroAvatarList] = useState(() => createHeroAvatars());
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatNotice, setChatNotice] = useState("");
  const [selectedCover, setSelectedCover] = useState("");
  const [profileForm, setProfileForm] = useState({
    nickname: "",
    currentCity: "",
    hobbies: "",
    partnerExpectation: "",
    avatarUrl: ""
  });

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
  const defaultCover = profilePhotos[0] || user?.avatarUrl || profileForm.avatarUrl || "https://picsum.photos/800/500?self";
  const profileCover = selectedCover || defaultCover;
  const userAvatar = profilePhotos[0] || user?.avatarUrl || profileForm.avatarUrl || "https://picsum.photos/200/200?self";
  const galleryPhotos = useMemo(() => {
    const list = [userAvatar, ...profilePhotos.slice(1)];
    const unique = [];
    list.forEach((item) => {
      if (item && !unique.includes(item)) unique.push(item);
    });
    return unique.slice(0, 3);
  }, [profilePhotos, userAvatar]);
  const myPosts = useMemo(() => {
    if (!user) return [];
    const fromSquare = posts.slice(0, 3).map((post) => ({
      id: `self-${post.id}`,
      text: post.text,
      likes: post.likes,
      createdAt: post.createdAt || "刚刚"
    }));
    if (fromSquare.length > 0) return fromSquare;
    return [
      {
        id: "self-default-1",
        text: `大家好，我是${user.nickname}，来这里认识有趣的人。`,
        likes: 3,
        createdAt: "刚刚"
      }
    ];
  }, [posts, user]);
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
  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unread || 0), 0),
    [conversations]
  );

  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.id || "";
  }, [activeConversation]);

  useEffect(() => {
    if (!chatNotice) return undefined;
    const timer = setTimeout(() => setChatNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [chatNotice]);

  const refreshChatPanels = async (currentUserId) => {
    try {
      const [contactsRes, convRes] = await Promise.all([
        fetch(`${API}/chat/contacts?userId=${currentUserId}`),
        fetch(`${API}/chat/conversations?userId=${currentUserId}`)
      ]);
      const contactsData = await contactsRes.json();
      const convData = await convRes.json();
      setContacts(Array.isArray(contactsData.contacts) ? contactsData.contacts : []);
      setConversations(Array.isArray(convData.conversations) ? convData.conversations : []);
    } catch (_error) {
      // Keep last successful data if refresh fails briefly.
    }
  };

  const refreshActiveMessages = async (currentUserId, peerId) => {
    try {
      const res = await fetch(`${API}/chat/messages?userId=${currentUserId}&peerId=${peerId}`);
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
      const peerId = message.fromUserId === user.id ? message.toUserId : message.fromUserId;
      const isActive = peerId === activeConversationIdRef.current;
      if (isActive) {
        setChatMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) return prev;
          return [...prev, message];
        });
        fetch(`${API}/chat/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, peerId })
        }).catch(() => null);
      }
      setConversations((prev) => {
        const exists = prev.some((item) => item.id === peerId);
        const nextUnread = message.fromUserId === user.id || isActive ? 0 : 1;
        if (message.fromUserId !== user.id && !isActive) {
          const peerName = prev.find((item) => item.id === peerId)?.name || "新朋友";
          setChatNotice(`${peerName} 发来新消息`);
        }
        if (!exists) {
          return [
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
        }
        return prev.map((item) =>
          item.id === peerId
            ? {
                ...item,
                preview: message.text,
                time: message.createdAt,
                unread:
                  message.fromUserId === user.id || isActive ? 0 : (item.unread || 0) + 1
              }
            : item
        );
      });
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user]);

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
    setUser(data.user);
    setMessage(`欢迎回来，${data.user.nickname}`);
  };

  const onRegister = async (e) => {
    e.preventDefault();
    if (!mustAgree()) return;
    setMessage("");
    const payload = {
      ...registerForm,
      age: Number(registerForm.age),
      height: Number(registerForm.height),
      weight: Number(registerForm.weight),
      photoUrls: [registerForm.photoUrl]
    };
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.message || "注册失败");
    setUser(data.user);
    setMessage("注册成功，已自动登录");
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
    setUser(data.user);
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
    setSession(null);
    setBlindBoxTarget(null);
    setGameState(null);
    setActiveConversation(null);
    setChatMessages([]);
    setChatInput("");
    setChatKeyword("");
    setMePage("home");
    setMeDetailPage("");
    setAuthMode("login");
    setMessage("请切换账号登录");
  };

  const logout = () => {
    setUser(null);
    setSession(null);
    setBlindBoxTarget(null);
    setGameState(null);
    setActiveConversation(null);
    setChatMessages([]);
    setChatInput("");
    setChatKeyword("");
    setMePage("home");
    setMeDetailPage("");
    setAuthMode("login");
    setMessage("已退出登录");
  };

  const openConversation = async (item) => {
    if (!user) return;
    setActiveConversation(item);
    setChatInput("");
    await refreshActiveMessages(user.id, item.id);
    setConversations((prev) =>
      prev.map((conv) => (conv.id === item.id ? { ...conv, unread: 0 } : conv))
    );
    fetch(`${API}/chat/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, peerId: item.id })
    }).catch(() => null);
  };

  const sendChatMessage = async () => {
    if (!user || !activeConversation) return;
    const text = chatInput.trim();
    if (!text) return;
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("chat:send", {
        toUserId: activeConversation.id,
        text
      });
      setChatInput("");
      return;
    }
    try {
      const res = await fetch(`${API}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUserId: user.id,
          toUserId: activeConversation.id,
          text
        })
      });
      const data = await res.json();
      if (!res.ok) return setMessage(data.message || "发送失败");
      setChatMessages((prev) => [...prev, data.message]);
      setChatInput("");
      setConversations((prev) =>
        prev.map((item) =>
          item.id === activeConversation.id
            ? { ...item, preview: data.message.text, time: data.message.createdAt }
            : item
        )
      );
    } catch (_error) {
      setMessage("发送失败，请稍后重试");
    }
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
            <input placeholder="手机号" value={registerForm.phone} onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))} required />
            <input placeholder="密码(至少6位)" type="password" value={registerForm.password} onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))} required />
            <input placeholder="昵称" value={registerForm.nickname} onChange={(e) => setRegisterForm((prev) => ({ ...prev, nickname: e.target.value }))} required />
            <select value={registerForm.gender} onChange={(e) => setRegisterForm((prev) => ({ ...prev, gender: e.target.value }))}>
              <option value="MALE">男</option>
              <option value="FEMALE">女</option>
            </select>
            <input placeholder="年龄" value={registerForm.age} onChange={(e) => setRegisterForm((prev) => ({ ...prev, age: e.target.value }))} required />
            <input placeholder="家乡" value={registerForm.hometown} onChange={(e) => setRegisterForm((prev) => ({ ...prev, hometown: e.target.value }))} required />
            <input placeholder="现居地" value={registerForm.currentCity} onChange={(e) => setRegisterForm((prev) => ({ ...prev, currentCity: e.target.value }))} required />
            <input placeholder="爱好(用逗号分隔)" value={registerForm.hobbies} onChange={(e) => setRegisterForm((prev) => ({ ...prev, hobbies: e.target.value }))} required />
            <input placeholder="对另一半要求" value={registerForm.partnerExpectation} onChange={(e) => setRegisterForm((prev) => ({ ...prev, partnerExpectation: e.target.value }))} required />
            <button className="login-main-btn" type="submit">
              注册并登录
            </button>
          </form>
        )}

        <div className="agree-row">
          <label>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
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
          <button className="quick-btn" onClick={() => quickLogin("device")} type="button">
            本机号码一键登录
          </button>
          <button className="quick-btn wechat" onClick={() => quickLogin("wechat")} type="button">
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
            <button className="header-btn">筛选</button>
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
        <section className="main-content chat-page">
          {activeConversation ? (
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
                      className={`chat-bubble ${msg.fromUserId === user.id ? "me-bubble" : "other-bubble"}`}
                    >
                      {msg.text}
                    </div>
                  ))
                )}
              </div>
              <div className="chat-detail-input-wrap">
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
                <button className="chat-add-btn" onClick={() => setMessage("发起新聊天功能开发中")}>
                  ＋
                </button>
              </div>
              {chatMode === "chat" ? (
                <div className="chat-list">
                  {filteredConversations.map((item) => (
                    <button
                      key={item.id}
                      className="chat-item chat-item-button"
                      type="button"
                      onClick={() => openConversation(item)}
                    >
                      <img src={item.avatar} alt={item.name} className="chat-avatar" />
                      <div className="chat-main">
                        <div className="chat-name-row">
                          <strong>{item.name}</strong>
                          <span>{formatChatTime(item.time)}</span>
                        </div>
                        <p>{item.preview}</p>
                      </div>
                      {item.unread > 0 && <span className="chat-unread">{item.unread > 9 ? "9+" : item.unread}</span>}
                    </button>
                  ))}
                  {filteredConversations.length === 0 && <p className="feed-tip">暂无匹配聊天记录</p>}
                </div>
              ) : (
                <div className="contact-list">
                  {filteredContacts.map((item) => (
                    <div key={item.id} className="contact-item">
                      <img src={item.avatar} alt={item.name} className="chat-avatar" />
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
                  <img className="profile-avatar" src={profileForm.avatarUrl || userAvatar} alt={user.nickname} />
                  <p>点击保存后将更新资料页封面和头像</p>
                </div>
                <div className="profile-editor">
                  <input
                    placeholder="昵称"
                    value={profileForm.nickname}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, nickname: e.target.value }))}
                  />
                  <input
                    placeholder="头像/封面地址（相册第一张）"
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
                <p>账号：{user.phone}</p>
                <p>个人签名：{user.partnerExpectation || "做一个有趣的人"}</p>
                <p>会员状态：{isMembershipValid ? "有效会员" : "免费用户"}</p>
              </div>

              <h3 className="section-title">我的动态</h3>
              <div className="my-post-list">
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

      {message && <p className="msg">{message}</p>}

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
