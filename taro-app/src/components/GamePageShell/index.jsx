import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";

export default function GamePageShell({
  variant = "default",
  title,
  subtitle,
  emoji,
  onBack,
  children
}) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    Taro.navigateBack().catch(() => Taro.switchTab({ url: "/pages/planet/index" }));
  };

  return (
    <View className={`game-page game-page--${variant}`}>
      <View className="game-page-head">
        <View className="game-page-toolbar">
          <Text className="game-page-back" onClick={handleBack}>
            ‹ 返回
          </Text>
        </View>
        <View className="game-page-title-block">
          {emoji ? <Text className="game-page-emoji">{emoji}</Text> : null}
          <View>
            <Text className="game-page-title">{title}</Text>
            {subtitle ? <Text className="game-page-subtitle">{subtitle}</Text> : null}
          </View>
        </View>
      </View>
      <View className="game-page-body">{children}</View>
    </View>
  );
}
