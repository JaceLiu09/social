import { useEffect, useMemo, useRef, useState } from "react";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

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
  const touchStartYRef = useRef(0);
  const pullTriggeredRef = useRef(false);
  const [message, setMessage] = useState("");
  const [loginForm, setLoginForm] = useState({ account: "", password: "" });
  const [registerForm, setRegisterForm] = useState(registerInitial);

  const friendlinessPercent = session?.friendliness ?? 0;

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

  const subscribe = async (plan) => {
    if (!user) return;
    const res = await fetch(`${API}/membership/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, plan })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.message || "开通失败");
    setUser(data.user);
    setMessage(`会员开通成功，支付 ${data.paid} 元`);
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

  if (!user) {
    return (
      <main className="login-page">
        <div className="close-btn">x</div>
        <p className="help-link">登录遇到困难？</p>

        <div className="hero-avatars">
          <img src="https://picsum.photos/74/74?girl1" alt="" />
          <img src="https://picsum.photos/74/74?boy1" alt="" />
          <img src="https://picsum.photos/74/74?girl2" alt="" />
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
      <header className="main-header">
        <div className="avatar-dot">{user.nickname.slice(0, 1).toUpperCase()}</div>
        <h1>盲盒星球</h1>
        <button className="header-btn">筛选</button>
      </header>

      {tab === "planet" && (
        <section className="main-content">
          <div className="hero-match-card">
            <div className="hero-level">Lv.1</div>
            <div className="hero-avatar-wrap">
              <div className="hero-avatar" />
            </div>
            <p className="hero-title">她在等你语音聊天</p>
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
        <section className="main-content">
          <h2>聊天</h2>
          <div className="status-card">
            <p>解锁资料后发起聊天，需要双方会员。</p>
            <div className="plans">
              <button onClick={() => subscribe("MONTH")}>月卡 49</button>
              <button onClick={() => subscribe("QUARTER")}>季卡 129</button>
              <button onClick={() => subscribe("HALF_YEAR")}>半年 199</button>
              <button onClick={() => subscribe("YEAR")}>年卡 359</button>
            </div>
            <p>会员状态：{isMembershipValid ? "有效会员" : "免费用户"}</p>
          </div>
        </section>
      )}

      {tab === "me" && (
        <section className="main-content">
          <h2>自己</h2>
          <div className="status-card">
            <p>昵称：{user.nickname}</p>
            <p>账号：{user.phone}</p>
            <p>当前城市：{user.currentCity}</p>
          </div>
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
        </button>
        <button className={tab === "me" ? "active" : ""} onClick={() => setTab("me")}>
          自己
        </button>
      </nav>
    </div>
  );
}
