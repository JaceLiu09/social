import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:4000";

const defaultForm = {
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
  photoUrl: ""
};

export default function App() {
  const [tab, setTab] = useState("match");
  const [form, setForm] = useState(defaultForm);
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [blindBoxTarget, setBlindBoxTarget] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [onlineCount, setOnlineCount] = useState(200000);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState("");

  const friendlinessPercent = session?.friendliness ?? 0;

  useEffect(() => {
    fetch(`${API}/square/posts`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts))
      .catch(() => setPosts([]));
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

  const onRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    const payload = {
      ...form,
      age: Number(form.age),
      height: Number(form.height),
      weight: Number(form.weight),
      photoUrls: [form.photoUrl]
    };
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.message || "注册失败");
    setUser(data.user);
    setMessage("注册成功，已登录");
  };

  const startMatch = async () => {
    if (!user) return setMessage("请先注册/登录");
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

  return (
    <div className="app">
      <h1>盲盒社交 MVP</h1>
      <p className="hint">核心规则：先互动，后解锁资料；男性解锁女性资料 1.9 元；聊天需会员。</p>

      <section className="card">
        <h2>1) 新用户资料填写</h2>
        {!user ? (
          <form className="grid" onSubmit={onRegister}>
            {Object.entries(defaultForm).map(([key]) => (
              <input
                key={key}
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={key}
                required={key !== "avatarUrl"}
              />
            ))}
            <button type="submit">注册并进入盲盒星球</button>
          </form>
        ) : (
          <p>当前用户：{user.nickname}（{user.gender === "MALE" ? "男" : "女"}）</p>
        )}
      </section>

      <nav className="tabs">
        <button onClick={() => setTab("match")}>开盲盒</button>
        <button onClick={() => setTab("square")}>盲盒广场</button>
        <button onClick={() => setTab("interacted")}>已互动</button>
      </nav>

      {tab === "match" && (
        <section className="card">
          <h2>开盲盒</h2>
          <p>盲盒星球在线：{onlineCount.toLocaleString()} 人</p>
          <button onClick={startMatch}>开始匹配</button>
          {blindBoxTarget && <p>已匹配到：{blindBoxTarget.nickname}（资料未解锁）</p>}
          {session && (
            <>
              <button onClick={playRound}>掷骰子进行一回合</button>
              <p>回合数：{session.roundsPlayed} / 5+</p>
              <p>友好度：{friendlinessPercent}%</p>
            </>
          )}
          {gameState && (
            <div className="result">
              <p>骰子点数：A={gameState.diceA}，B={gameState.diceB}</p>
              <p>真心话题目：{gameState.question}</p>
              <p>预制回答：{gameState.options.join(" / ")}</p>
            </div>
          )}
          {session?.isUnlocked && user?.gender === "MALE" && (
            <button onClick={unlockProfile}>支付1.9元解锁女方资料</button>
          )}
        </section>
      )}

      {tab === "square" && (
        <section className="card">
          <h2>盲盒广场（文字互动）</h2>
          {posts.map((post) => (
            <div className="post" key={post.id}>
              <div className="blindbox-avatar">盲盒</div>
              <p>{post.text}</p>
              <small>点赞 {post.likes}</small>
            </div>
          ))}
        </section>
      )}

      {tab === "interacted" && (
        <section className="card">
          <h2>已互动</h2>
          <p>解锁资料后发起聊天，需要双方会员。</p>
          <div className="plans">
            <button onClick={() => subscribe("MONTH")}>月卡 49</button>
            <button onClick={() => subscribe("QUARTER")}>季卡 129</button>
            <button onClick={() => subscribe("HALF_YEAR")}>半年 199</button>
            <button onClick={() => subscribe("YEAR")}>年卡 359</button>
          </div>
          <p>会员状态：{isMembershipValid ? "有效会员" : "免费用户"}</p>
        </section>
      )}

      {message && <p className="msg">{message}</p>}
    </div>
  );
}
