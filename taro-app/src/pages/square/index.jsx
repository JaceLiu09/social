import { View, Text } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { isLoggedIn } from "../../services/auth";
import "./index.scss";

export default function SquarePage() {
  useDidShow(() => {
    if (!isLoggedIn()) Taro.reLaunch({ url: "/pages/login/index" });
  });

  return (
    <View className="placeholder-page">
      <Text className="placeholder-title">广场</Text>
      <Text className="placeholder-desc">动态列表迁移中，API 已指向 manghe.me</Text>
    </View>
  );
}
