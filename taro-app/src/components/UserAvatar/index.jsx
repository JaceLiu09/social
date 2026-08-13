import { View, Image } from "@tarojs/components";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

export default function UserAvatar({ src, size = 80, className = "" }) {
  const url = resolveAvatarUrl(src);
  const px = `${size}rpx`;
  return (
    <View className={`user-avatar ${className}`} style={{ width: px, height: px }}>
      {url ? (
        <Image className="user-avatar-img" mode="aspectFill" src={url} style={{ width: px, height: px }} />
      ) : (
        <View className="user-avatar-fallback" style={{ width: px, height: px }} />
      )}
    </View>
  );
}
