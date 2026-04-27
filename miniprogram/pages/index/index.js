const api = require("../../utils/api.js");

const STORAGE_KEY = "social_user";

const defaultForm = {
  phone: "",
  password: "",
  nickname: "",
  age: "24",
  height: "170",
  weight: "60",
  hometown: "",
  currentCity: "",
  hobbies: "",
  partnerExpectation: "",
  avatarUrl: "",
  photoUrl: "https://picsum.photos/seed/profile/600/800"
};

Page({
  data: {
    authMode: "register",
    genders: ["男", "女"],
    genderIndex: 0,
    genderValues: ["MALE", "FEMALE"],
    form: { ...defaultForm },
    loginForm: { phone: "", password: "" },
    user: null,
    tab: "match",
    session: null,
    targetBlindBox: null,
    gameState: null,
    onlineCount: 200000,
    posts: [],
    message: "",
    loading: false,
    membershipText: ""
  },

  timer: null,

  onLoad() {
    const user = wx.getStorageSync(STORAGE_KEY) || null;
    this.setData({ user });
    if (user) {
      this.refreshMembershipText(user);
      this.loadSquare();
      this.pullOnline();
      this.timer = setInterval(() => this.pullOnline(), 60000);
    }
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  refreshMembershipText(user) {
    const valid =
      user &&
      user.membershipType &&
      user.membershipType !== "FREE" &&
      user.membershipExpireAt &&
      new Date(user.membershipExpireAt) > new Date();
    this.setData({
      membershipText: valid ? "会员：有效" : "会员：未开通"
    });
  },

  showMsg(text) {
    this.setData({ message: text });
    if (this._msgTimer) clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => this.setData({ message: "" }), 2800);
  },

  onAuthMode(e) {
    this.setData({ authMode: e.currentTarget.dataset.mode });
  },

  onForm(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ [`form.${k}`]: e.detail.value });
  },

  onLoginForm(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ [`loginForm.${k}`]: e.detail.value });
  },

  onGender(e) {
    this.setData({ genderIndex: Number(e.detail.value) });
  },

  async onRegister() {
    const { form, genderIndex, genderValues } = this.data;
    this.setData({ loading: true });
    try {
      const payload = {
        phone: form.phone.trim(),
        password: form.password,
        nickname: form.nickname.trim(),
        gender: genderValues[genderIndex],
        age: Number(form.age),
        height: Number(form.height),
        weight: Number(form.weight),
        hometown: form.hometown.trim(),
        currentCity: form.currentCity.trim(),
        hobbies: form.hobbies.trim(),
        partnerExpectation: form.partnerExpectation.trim(),
        avatarUrl: form.avatarUrl.trim() || undefined,
        photoUrls: [form.photoUrl.trim()]
      };
      const data = await api.register(payload);
      wx.setStorageSync(STORAGE_KEY, data.user);
      this.setData({ user: data.user });
      this.refreshMembershipText(data.user);
      this.loadSquare();
      this.pullOnline();
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => this.pullOnline(), 60000);
      this.showMsg("注册成功");
    } catch (err) {
      this.showMsg(err.message || "注册失败");
    } finally {
      this.setData({ loading: false });
    }
  },

  async onLogin() {
    const { loginForm } = this.data;
    this.setData({ loading: true });
    try {
      const data = await api.login({
        phone: loginForm.phone.trim(),
        password: loginForm.password
      });
      wx.setStorageSync(STORAGE_KEY, data.user);
      this.setData({ user: data.user });
      this.refreshMembershipText(data.user);
      this.loadSquare();
      this.pullOnline();
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => this.pullOnline(), 60000);
      this.showMsg("登录成功");
    } catch (err) {
      this.showMsg(err.message || "登录失败");
    } finally {
      this.setData({ loading: false });
    }
  },

  onLogout() {
    wx.removeStorageSync(STORAGE_KEY);
    if (this.timer) clearInterval(this.timer);
    this.setData({
      user: null,
      session: null,
      targetBlindBox: null,
      gameState: null,
      tab: "match",
      posts: []
    });
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  async loadSquare() {
    try {
      const data = await api.getPosts();
      this.setData({ posts: data.posts || [] });
    } catch (_) {
      this.setData({ posts: [] });
    }
  },

  async pullOnline() {
    try {
      const data = await api.getOnlineCount();
      this.setData({ onlineCount: data.count });
    } catch (_) {
      /* ignore */
    }
  },

  async startMatch() {
    const { user } = this.data;
    if (!user) return;
    this.setData({ loading: true });
    try {
      const data = await api.startMatch(user.id);
      this.setData({
        session: data.session,
        targetBlindBox: data.targetBlindBox,
        gameState: null
      });
      this.showMsg("匹配成功，开始掷骰子");
    } catch (err) {
      this.showMsg(err.message || "匹配失败");
    } finally {
      this.setData({ loading: false });
    }
  },

  async playRound() {
    const { session } = this.data;
    if (!session) return;
    this.setData({ loading: true });
    try {
      const data = await api.diceRound(session.id);
      const opts = data.result.options || [];
      this.setData({
        gameState: {
          ...data.result,
          optionsTxt: opts.join(" / ")
        },
        session: data.progress
      });
    } catch (err) {
      this.showMsg(err.message || "回合失败");
    } finally {
      this.setData({ loading: false });
    }
  },

  async unlockProfile() {
    const { session, user } = this.data;
    if (!session || !user) return;
    this.setData({ loading: true });
    try {
      const data = await api.unlock(session.id, session.maleUserId);
      this.showMsg(`已支付 ${data.amount} 元（模拟），解锁成功`);
    } catch (err) {
      this.showMsg(err.message || "解锁失败");
    } finally {
      this.setData({ loading: false });
    }
  },

  async subscribe(e) {
    const plan = e.currentTarget.dataset.plan;
    const { user } = this.data;
    if (!user) return;
    this.setData({ loading: true });
    try {
      const data = await api.subscribe(user.id, plan);
      wx.setStorageSync(STORAGE_KEY, data.user);
      this.setData({ user: data.user });
      this.refreshMembershipText(data.user);
      this.showMsg(`开通成功，模拟支付 ${data.paid} 元`);
    } catch (err) {
      this.showMsg(err.message || "开通失败");
    } finally {
      this.setData({ loading: false });
    }
  }
});
