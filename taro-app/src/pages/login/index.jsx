import { useState } from "react";
import { View, Input, Button, Text } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { loginWithPassword, registerBasic, isLoggedIn, needsProfileSetup } from "../../services/auth";
import "./index.scss";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [smsCode, setSmsCode] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useLoad(() => {
    if (isLoggedIn()) {
      Taro.switchTab({ url: "/pages/planet/index" });
    }
  });

  const afterAuth = (data) => {
    if (needsProfileSetup(data.user)) {
      Taro.redirectTo({ url: "/pages/profile-setup/index" });
      return;
    }
    Taro.switchTab({ url: "/pages/planet/index" });
  };

  const onSubmit = async () => {
    const phone = account.trim();
    if (!phone || !password.trim()) {
      setMessage("请输入账号和密码");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const data =
        mode === "register"
          ? await registerBasic(phone, password, smsCode)
          : await loginWithPassword(phone, password);
      afterAuth(data);
    } catch (error) {
      setMessage(error.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="login-page">
      <Text className="login-title">盲盒星球</Text>
      <Text className="login-sub">来盲盒开出属于你的隐藏款</Text>

      <View className="login-tabs">
        <Text className={`login-tab ${mode === "login" ? "login-tab--active" : ""}`} onClick={() => setMode("login")}>
          登录
        </Text>
        <Text
          className={`login-tab ${mode === "register" ? "login-tab--active" : ""}`}
          onClick={() => setMode("register")}
        >
          注册
        </Text>
      </View>

      <View className="login-form">
        <Input
          className="login-input"
          placeholder="盲盒号 / 手机号"
          value={account}
          onInput={(e) => setAccount(e.detail.value)}
        />
        <Input
          className="login-input"
          password
          placeholder="请输入密码"
          value={password}
          onInput={(e) => setPassword(e.detail.value)}
        />
        {mode === "register" ? (
          <Input
            className="login-input"
            placeholder="短信验证码（测试码 123456）"
            value={smsCode}
            onInput={(e) => setSmsCode(e.detail.value)}
          />
        ) : null}
        {message ? <Text className="login-msg">{message}</Text> : null}
        <Button className="login-btn" loading={loading} onClick={onSubmit}>
          {mode === "register" ? "注册" : "登录"}
        </Button>
      </View>

      <Text className="login-tip">API：manghe.me · Taro 原生小程序</Text>
      <View className="login-legal">
        <Text onClick={() => Taro.navigateTo({ url: "/pages/legal/index?type=agreement" })}>用户协议</Text>
        <Text> · </Text>
        <Text onClick={() => Taro.navigateTo({ url: "/pages/legal/index?type=privacy" })}>隐私政策</Text>
      </View>
    </View>
  );
}
