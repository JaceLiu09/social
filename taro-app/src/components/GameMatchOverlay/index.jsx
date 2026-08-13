import { View, Text } from "@tarojs/components";

export default function GameMatchOverlay({ open, elapsedSec = 0, tip = "正在为你寻找同频玩家" }) {
  if (!open) return null;
  return (
    <View className="game-match-overlay">
      <View className="game-match-modal">
        <Text className="game-match-label">正在匹配</Text>
        <View className="game-match-spinner">
          <Text className="game-match-dot" />
          <Text className="game-match-dot" />
          <Text className="game-match-dot" />
        </View>
        {elapsedSec > 0 ? <Text className="game-match-elapsed">已等待 {elapsedSec}s</Text> : null}
        <Text className="game-match-tip">{tip}</Text>
      </View>
    </View>
  );
}
