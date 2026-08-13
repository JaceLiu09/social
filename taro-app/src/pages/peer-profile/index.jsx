import { useState } from "react";
import { View, Text, Image, Button, ScrollView } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import UserAvatar from "../../components/UserAvatar";
import { ensureLoggedIn } from "../../services/auth";
import { fetchUserProfile, fetchFollowStatus, followUser, unfollowUser } from "../../services/profile";
import { fetchGiftCatalog, sendGift } from "../../services/gifts";
import { fetchWallet } from "../../services/wallet";
import { resolveAvatarUrl } from "../../utils/media";
import { formatGender } from "../../utils/format";
import "./index.scss";

export default function PeerProfilePage() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState(null);
  const [followed, setFollowed] = useState(false);
  const [gifts, setGifts] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGifts, setShowGifts] = useState(false);

  useLoad((query) => {
    if (!ensureLoggedIn()) return;
    const id = String(query.userId || "").trim();
    setUserId(id);
    if (id) loadAll(id);
  });

  const loadAll = async (id) => {
    setLoading(true);
    try {
      const [profileRes, followRes, giftRes, walletRes] = await Promise.all([
        fetchUserProfile(id),
        fetchFollowStatus(id).catch(() => ({ followed: false })),
        fetchGiftCatalog().catch(() => ({ gifts: [] })),
        fetchWallet().catch(() => ({ wallet: null }))
      ]);
      setProfile(profileRes.profile || profileRes.user || profileRes);
      setFollowed(Boolean(followRes.followed));
      setGifts(Array.isArray(giftRes.gifts) ? giftRes.gifts : []);
      setWallet(walletRes.wallet || null);
      Taro.setNavigationBarTitle({ title: profileRes.profile?.nickname || "资料" });
    } catch (error) {
      Taro.showToast({ title: error.message || "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    try {
      if (followed) await unfollowUser(userId);
      else await followUser(userId);
      setFollowed(!followed);
    } catch (error) {
      Taro.showToast({ title: error.message || "操作失败", icon: "none" });
    }
  };

  const openChat = () => {
    Taro.navigateTo({
      url: `/pages/chat-room/index?peerId=${encodeURIComponent(userId)}&name=${encodeURIComponent(profile?.nickname || "用户")}`
    });
  };

  const sendGiftToPeer = async (giftId) => {
    try {
      await sendGift(userId, giftId, 1);
      Taro.showToast({ title: "礼物已送出", icon: "success" });
      setShowGifts(false);
    } catch (error) {
      Taro.showToast({ title: error.message || "送礼失败", icon: "none" });
    }
  };

  if (loading) {
    return <View className="peer-page"><Text className="peer-loading">加载中…</Text></View>;
  }

  if (!profile) {
    return <View className="peer-page"><Text className="peer-loading">用户不存在</Text></View>;
  }

  const gallery = Array.isArray(profile.galleryUrls)
    ? profile.galleryUrls
    : Array.isArray(profile.photoUrls)
      ? profile.photoUrls
      : profile.avatarUrl
        ? [profile.avatarUrl]
        : [];

  return (
    <ScrollView className="peer-page" scrollY>
      <View className="peer-hero">
        <Image className="peer-cover" mode="aspectFill" src={resolveAvatarUrl(gallery[0] || profile.avatarUrl)} />
        <View className="peer-hero-info">
          <Text className="peer-name">{profile.nickname || "用户"}</Text>
          <Text className="peer-meta">
            {[profile.age ? `${profile.age}岁` : "", formatGender(profile.gender), profile.currentCity || profile.city]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>

      {gallery.length > 1 ? (
        <ScrollView className="peer-gallery" scrollX>
          {gallery.map((url, i) => (
            <Image key={`${url}-${i}`} className="peer-gallery-item" mode="aspectFill" src={resolveAvatarUrl(url)} />
          ))}
        </ScrollView>
      ) : null}

      <View className="peer-section">
        {profile.hobbies ? (<><Text className="peer-label">爱好</Text><Text className="peer-text">{profile.hobbies}</Text></>) : null}
        {profile.partnerExpectation ? (<><Text className="peer-label">期待</Text><Text className="peer-text">{profile.partnerExpectation}</Text></>) : null}
      </View>

      <View className="peer-actions">
        <Button className="ghost-btn" onClick={toggleFollow}>{followed ? "已关注" : "关注"}</Button>
        <Button className="ghost-btn" onClick={() => setShowGifts(true)}>送礼物</Button>
        <Button className="primary-btn" onClick={openChat}>发消息</Button>
      </View>

      {showGifts ? (
        <View className="peer-gift-sheet">
          <Text className="peer-label">选择礼物 · 金币 {wallet?.coinBalance ?? 0}</Text>
          {gifts.map((gift) => (
            <View key={gift.id} className="peer-gift-row" onClick={() => sendGiftToPeer(gift.id)}>
              <Text>{gift.emoji || "🎁"} {gift.name}</Text>
              <Text>{gift.coinPrice} 金币</Text>
            </View>
          ))}
          <Button className="ghost-btn" onClick={() => setShowGifts(false)}>关闭</Button>
        </View>
      ) : null}
    </ScrollView>
  );
}
