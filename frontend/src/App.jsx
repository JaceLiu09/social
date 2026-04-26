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
    if (!res.ok) {
      setMessage(data.message || "注册失败");
      return;
    }
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
import { useMemo, useState } from "react";
import { api } from "./api";

const profileInit = {
  nickname: "",
  gender: "male",
  age: "",
  height: "",
  hometown: "",
  city: "",
  hobbies: "",
  partnerRequirement: ""
};

const tabs = ["开盲盒", "盲盒广场", "已互动"];

function App() {
  const [profile, setProfile] = useState(profileInit);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("开盲盒");
  const [posts, setPosts] = useState([]);
  const [matching, setMatching] = useState(null);
  const [answer, setAnswer] = useState("A");
  const [loading, setLoading] = useState(false);
  const [onlineSeed] = useState(Math.floor(Math.random() * 120000) + 180000);

  const onlineCount = useMemo(() => {
    const delta = Math.floor(Math.random() * 5001);
    return onlineSeed + (Math.random() > 0.5 ? delta : -delta);
  }, [onlineSeed, matching]);

  async function submitProfile(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.registerProfile(profile);
      setUser(res.user);
      const plaza = await api.getPlazaPosts();
      setPosts(plaza.posts);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function startMatch() {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.matchBlindbox(user.id);
      setMatching(res.session);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function playOneRound() {
    if (!matching) return;
    setLoading(true);
    try {
      const res = await api.playRound(matching.id, {
        winnerQuestion: "如果你明天可以去任何城市，你会去哪？",
        loserAnswer: answer
      });
      setMatching(res.session);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <main className="page">
        <section className="card">
          <h1>盲盒社交 MVP</h1>
          <p>先互动，再解锁资料。先确认灵魂匹配，再决定是否聊天。</p>
          <form onSubmit={submitProfile} className="form">
            <input
              placeholder="昵称"
              value={profile.nickname}
              onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
              required
            />
            <select
              value={profile.gender}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
            >
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
            <input
              placeholder="年龄"
              value={profile.age}
              onChange={(e) => setProfile({ ...profile, age: e.target.value })}
              required
            />
            <input
              placeholder="身高(cm)"
              value={profile.height}
              onChange={(e) => setProfile({ ...profile, height: e.target.value })}
            />
            <input
              placeholder="家乡"
              value={profile.hometown}
              onChange={(e) => setProfile({ ...profile, hometown: e.target.value })}
            />
            <input
              placeholder="现居地"
              value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
            />
            <textarea
              placeholder="爱好"
              value={profile.hobbies}
              onChange={(e) => setProfile({ ...profile, hobbies: e.target.value })}
            />
            <textarea
              placeholder="对另一半要求"
              value={profile.partnerRequirement}
              onChange={(e) =>
                setProfile({ ...profile, partnerRequirement: e.target.value })
              }
            />
            <button type="submit" disabled={loading}>
              {loading ? "提交中..." : "完成资料并进入盲盒"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="header card">
        <div>
          <h2>你好，{user.nickname}</h2>
          <small>当前盲盒星球在线：{onlineCount.toLocaleString()}</small>
        </div>
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={tab === activeTab ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "开盲盒" && (
        <section className="card">
          <h3>开盲盒匹配</h3>
          {!matching ? (
            <button onClick={startMatch} disabled={loading}>
              {loading ? "匹配中..." : "开始开盲盒"}
            </button>
          ) : (
            <>
              <p>已匹配到异性盲盒：{matching.partnerBlindboxName}</p>
              <p>当前回合：{matching.rounds} / 10</p>
              <p>友好度：{matching.friendliness}%</p>
              <label>输家预制答案</label>
              <select value={answer} onChange={(e) => setAnswer(e.target.value)}>
                <option value="A">A 我会努力争取</option>
                <option value="B">B 我想先观望</option>
                <option value="C">C 看缘分安排</option>
                <option value="D">D 暂时不考虑</option>
              </select>
              <button onClick={playOneRound} disabled={loading || matching.friendliness >= 100}>
                进行一回合掷骰子问答
              </button>
              {matching.friendliness >= 100 && (
                <p className="success">
                  已达到 100% 友好度，可解锁资料权限（男性需支付 1.9 元）。
                </p>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === "盲盒广场" && (
        <section className="card">
          <h3>盲盒广场（只看文字，不展示资料）</h3>
          <ul className="list">
            {posts.map((post) => (
              <li key={post.id}>
                <strong>{post.blindboxName}</strong>
                <p>{post.content}</p>
                <small>点赞 {post.likes}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === "已互动" && (
        <section className="card">
          <h3>已互动</h3>
          <p>当前 MVP 展示匹配记录，后续可接入聊天与会员双向校验。</p>
          {matching ? (
            <p>
              最近互动对象：{matching.partnerBlindboxName}，友好度 {matching.friendliness}%
            </p>
          ) : (
            <p>你还没有完成互动，先去开盲盒吧。</p>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
