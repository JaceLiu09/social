import { View, Text, Button } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { getCurrentUser, isLoggedIn, logout } from "../../services/auth";
import "../square/index.scss";
import "./index.scss";

export default function MePage() {
  useDidShow(() => {
    if (!isLoggedIn()) Taro.reLaunch({ url: "/pages/login/index" });
  });

  const user = getCurrentUser();

  return (
    <View className="me-page">
      <View className="me-card">
        <Text className="me-name">{user?.nickname || "未登录"}</Text>
        <Text className="me-meta">{user?.currentCity || "完善资料"}</Text>
      </View>
      <Button className="me-logout" onClick={logout}>
        退出登录
      </Button>
      <Text className="me-api">服务端 API：https://manghe.me</Text>
    </View>
  );
}
