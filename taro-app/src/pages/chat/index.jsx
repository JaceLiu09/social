import { View, Text } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { isLoggedIn } from "../../services/auth";
import "../square/index.scss";

export default function ChatPage() {
  useDidShow(() => {
    if (!isLoggedIn()) Taro.reLaunch({ url: "/pages/login/index" });
  });

  return (
    <View className="placeholder-page">
      <Text className="placeholder-title">聊天</Text>
      <Text className="placeholder-desc">会话列表迁移中</Text>
    </View>
  );
}
