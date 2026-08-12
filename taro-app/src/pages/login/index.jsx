import { useState } from "react";
import { View, Input, Button, Text } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { loginWithPassword, isLoggedIn } from "../../services/auth";
import "./index.scss";

export default function LoginPage() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useLoad(() => {
    if (isLoggedIn()) {
      Taro.switchTab({ url: "/pages/planet/index" });
    }
  });

  const onSubmit = async () => {
    const phone = account.trim();
    if (!phone || !password.trim()) {
      setMessage("请输入账号和密码");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const data = await loginWithPassword(phone, password);
      if (data.needsProfile || !data.user?.profileCompleted) {
        Taro.showToast({ title: "登录成功，请完善资料", icon: "none" });
      }
      Taro.switchTab({ url: "/pages/planet/index" });
    } catch (error) {
      setMessage(error.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="login-page">
      <Text className="login-title">盲盒星球</Text>
      <Text className="login-sub">来盲盒开出属于你的隐藏款</Text>

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
        {message ? <Text className="login-msg">{message}</Text> : null}
        <Button className="login-btn" loading={loading} onClick={onSubmit}>
          登录
        </Button>
      </View>

      <Text className="login-tip">API：manghe.me · Taro 原生小程序</Text>
    </View>
  );
}
