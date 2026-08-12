import { useState } from "react";
import { View, Text, Image, Button } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { requestJson } from "../../services/api";
import { isLoggedIn, getCurrentUser } from "../../services/auth";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

export default function PlanetPage() {
  const [onlineCount, setOnlineCount] = useState(0);
  const [heroes, setHeroes] = useState([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: "/pages/login/index" });
      return;
    }
    loadData();
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [countRes, libRes] = await Promise.all([
        requestJson("/match/online-count").catch(() => ({ count: 0 })),
        requestJson("/public/robot-library/system").catch(() => ({ items: [] }))
      ]);
      setOnlineCount(Number(countRes.count) || 0);
      setHeroes(Array.isArray(libRes.items) ? libRes.items.slice(0, 6) : []);
    } finally {
      setLoading(false);
    }
  };

  const user = getCurrentUser();

  return (
    <View className="planet-page">
      <View className="hero-card">
        <Text className="hero-label">附近推荐</Text>
        <View className="hero-grid">
          {loading ? (
            <Text className="muted">加载中…</Text>
          ) : heroes.length ? (
            heroes.map((item, i) => (
              <View key={`${item.nickname}-${i}`} className="hero-item">
                <Image
                  className="hero-avatar"
                  mode="aspectFill"
                  src={resolveAvatarUrl(item.avatar)}
                />
                <Text className="hero-name">{item.nickname || "隐藏款"}</Text>
              </View>
            ))
          ) : (
            <Text className="muted">暂无推荐</Text>
          )}
        </View>
        <Text className="hero-title">寻找你附近的隐藏款</Text>
        <Button className="hero-btn" onClick={() => Taro.showToast({ title: "匹配流程开发中", icon: "none" })}>
          开始寻找
        </Button>
      </View>

      <Text className="online-strip">
        当前 {onlineCount.toLocaleString()} 人在线
        {user?.nickname ? ` · 你好，${user.nickname}` : ""}
      </Text>
    </View>
  );
}
