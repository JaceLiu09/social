import { useState } from "react";
import { View, Text, Image, Button, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { PLANET_MATCH_GAMES } from "../../constants/games";
import { requestJson } from "../../services/api";
import { ensureLoggedIn, ensureProfileOrRedirect, getCurrentUser } from "../../services/auth";
import { startMatchFlow } from "../../services/match";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

export default function PlanetPage() {
  const [onlineCount, setOnlineCount] = useState(0);
  const [heroes, setHeroes] = useState([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    if (!ensureLoggedIn()) return;
    if (!ensureProfileOrRedirect()) return;
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

  const openGame = (gameId) => {
    Taro.navigateTo({ url: `/pages/game/index?game=${gameId}` });
  };

  return (
    <ScrollView className="planet-page" scrollY enhanced showScrollbar={false}>
      <View className="hero-card">
        <Text className="hero-label">附近推荐</Text>
        <View className="hero-grid">
          {loading ? (
            <Text className="muted">加载中…</Text>
          ) : heroes.length ? (
            heroes.map((item, i) => (
              <View key={`${item.id || item.nickname}-${i}`} className="hero-item">
                <Image
                  className="hero-avatar"
                  mode="aspectFill"
                  src={resolveAvatarUrl(item.avatar || item.avatarUrl)}
                />
                <Text className="hero-name">{item.nickname || "隐藏款"}</Text>
              </View>
            ))
          ) : (
            <Text className="muted">暂无推荐</Text>
          )}
        </View>
        <Text className="hero-title">寻找你附近的隐藏款</Text>
        <Button className="hero-btn" onClick={startMatchFlow}>
          开始寻找
        </Button>
      </View>

      <Text className="online-strip">
        当前 {onlineCount.toLocaleString()} 人在线
        {user?.nickname ? ` · 你好，${user.nickname}` : ""}
      </Text>

      <View className="games-section">
        <Text className="games-title">互动玩法</Text>
        <View className="games-grid">
          {PLANET_MATCH_GAMES.map((game) => (
            <View key={game.id} className={`game-card game-card--${game.variant}`} onClick={() => openGame(game.id)}>
              {game.badge ? <Text className="game-badge">{game.badge}</Text> : null}
              <Text className="game-emoji">{game.emoji}</Text>
              <Text className="game-name">{game.title}</Text>
              {game.desc ? <Text className="game-desc">{game.desc}</Text> : null}
              <Text className="game-players">{game.players}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
