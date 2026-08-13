import { useState } from "react";
import { View, Text, Button, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import UserAvatar from "../../components/UserAvatar";
import { requestJson } from "../../services/api";
import { ensureLoggedIn, getCurrentUser, logout, needsProfileSetup } from "../../services/auth";
import { fetchMySquarePosts } from "../../services/profile";
import { fetchWallet } from "../../services/wallet";
import { formatGender } from "../../utils/format";
import "./index.scss";

const MENU = [
  { key: "edit", label: "编辑资料", url: "/pages/me-edit/index" },
  { key: "compose", label: "发动态", url: "/pages/me-compose/index" },
  { key: "wallet", label: "钱包 / VIP", url: "/pages/me-wallet/index" },
  { key: "privacy", label: "隐私政策", url: "/pages/legal/index?type=privacy" },
  { key: "agreement", label: "用户协议", url: "/pages/legal/index?type=agreement" }
];

export default function MePage() {
  const [wallet, setWallet] = useState(null);
  const [myPosts, setMyPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  useDidShow(() => {
    if (!ensureLoggedIn()) return;
    loadData();
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [w, posts] = await Promise.all([
        fetchWallet().catch(() => ({ wallet: null })),
        fetchMySquarePosts().catch(() => ({ posts: [] }))
      ]);
      setWallet(w.wallet || null);
      setMyPosts(Array.isArray(posts.posts) ? posts.posts : []);
    } finally {
      setLoading(false);
    }
  };

  const user = getCurrentUser();

  return (
    <ScrollView className="me-page" scrollY enhanced>
      <View className="me-header">
        <UserAvatar src={user?.avatarUrl} size={120} />
        <View className="me-header-main">
          <Text className="me-name">{user?.nickname || "未登录"}</Text>
          <Text className="me-meta">
            {[formatGender(user?.gender), user?.currentCity || user?.hometown].filter(Boolean).join(" · ") ||
              "完善资料后可展示更多信息"}
          </Text>
        </View>
      </View>

      {needsProfileSetup(user) ? (
        <Button className="me-setup-btn primary-btn" onClick={() => Taro.navigateTo({ url: "/pages/profile-setup/index" })}>
          完善资料
        </Button>
      ) : null}

      <View className="me-stats">
        <View className="me-stat">
          <Text className="me-stat-num">{loading ? "…" : wallet?.coinBalance ?? 0}</Text>
          <Text className="me-stat-label">金币</Text>
        </View>
        <View className="me-stat">
          <Text className="me-stat-num">{loading ? "…" : wallet?.charmValue ?? 0}</Text>
          <Text className="me-stat-label">魅力值</Text>
        </View>
        <View className="me-stat">
          <Text className="me-stat-num">{loading ? "…" : myPosts.length}</Text>
          <Text className="me-stat-label">动态</Text>
        </View>
      </View>

      <View className="me-menu">
        {MENU.map((item) => (
          <View key={item.key} className="me-menu-row" onClick={() => Taro.navigateTo({ url: item.url })}>
            <Text>{item.label}</Text>
            <Text className="me-menu-arrow">›</Text>
          </View>
        ))}
      </View>

      {myPosts.length ? (
        <View className="me-posts">
          <Text className="section-title">我的动态</Text>
          {myPosts.slice(0, 5).map((post) => (
            <View key={post.id} className="me-post-row">
              <Text className="me-post-text">{post.text || "[图片动态]"}</Text>
              <Text className="me-post-time">{post.createdAt}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Button className="me-logout ghost-btn" onClick={logout}>退出登录</Button>
    </ScrollView>
  );
}
