import { useState } from "react";
import { View, Text, Image, Button, Swiper, SwiperItem } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { ensureLoggedIn } from "../../services/auth";
import { clearMatchResult, getMatchResult } from "../../utils/matchCache";
import { formatGender } from "../../utils/format";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

export default function MatchPage() {
  const [result, setResult] = useState(null);

  useDidShow(() => {
    if (!ensureLoggedIn()) return;
    const cached = getMatchResult();
    if (!cached?.profile) {
      Taro.showToast({ title: "暂无匹配结果", icon: "none" });
      setTimeout(() => Taro.switchTab({ url: "/pages/planet/index" }), 600);
      return;
    }
    setResult(cached);
  });

  const profile = result?.profile;
  const gallery = profile?.galleryUrls?.length
    ? profile.galleryUrls
    : profile?.avatar
      ? [profile.avatar]
      : [];

  const openChat = () => {
    const peerId = result?.targetBlindBox?.id || profile?.id;
    if (!peerId) {
      Taro.showToast({ title: "无法发起聊天", icon: "none" });
      return;
    }
    Taro.navigateTo({
      url: `/pages/chat-room/index?peerId=${encodeURIComponent(peerId)}&name=${encodeURIComponent(profile?.nickname || "匹配对象")}`
    });
  };

  const backPlanet = () => {
    clearMatchResult();
    Taro.switchTab({ url: "/pages/planet/index" });
  };

  if (!profile) {
    return <View className="match-page" />;
  }

  return (
    <View className="match-page">
      <View className="match-card">
        <Text className="match-kicker">匹配成功</Text>
        <Text className="match-title">{profile.nickname || "隐藏款"}</Text>
        <Text className="match-sub">
          {[profile.age ? `${profile.age}岁` : "", formatGender(profile.gender), profile.city, result.randomKm ? `约 ${result.randomKm}km` : ""]
            .filter(Boolean)
            .join(" · ")}
        </Text>

        {gallery.length ? (
          <Swiper className="match-gallery" indicatorDots circular>
            {gallery.map((url, i) => (
              <SwiperItem key={`${url}-${i}`}>
                <Image className="match-photo" mode="aspectFill" src={resolveAvatarUrl(url)} />
              </SwiperItem>
            ))}
          </Swiper>
        ) : null}

        {profile.partnerExpectation ? (
          <View className="match-block">
            <Text className="match-label">期待</Text>
            <Text className="match-text">{profile.partnerExpectation}</Text>
          </View>
        ) : null}

        {profile.hobbies ? (
          <View className="match-block">
            <Text className="match-label">爱好</Text>
            <Text className="match-text">{profile.hobbies}</Text>
          </View>
        ) : null}

        <Button className="match-btn primary-btn" onClick={openChat}>
          发消息
        </Button>
        <Button className="match-btn ghost-btn" onClick={backPlanet}>
          继续寻找
        </Button>
      </View>
    </View>
  );
}
