import { useState, useRef } from "react";
import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import UserAvatar from "../../components/UserAvatar";
import { requestJson } from "../../services/api";
import { ensureLoggedIn, ensureProfileOrRedirect } from "../../services/auth";
import { formatDistanceKm } from "../../utils/format";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

const PAGE_SIZE = 20;

async function getViewerCoords() {
  try {
    const loc = await Taro.getLocation({ type: "gcj02" });
    if (Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
      return { lat: loc.latitude, lng: loc.longitude };
    }
  } catch (_error) {
    /* location optional */
  }
  return null;
}

export default function SquarePage() {
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const offsetRef = useRef(0);
  const loadedRef = useRef(false);

  useDidShow(() => {
    if (!ensureLoggedIn()) return;
    if (!ensureProfileOrRedirect()) return;
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadPosts(true);
    }
  });

  const loadPosts = async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const targetOffset = reset ? 0 : offsetRef.current;
      const coords = await getViewerCoords();
      const locParams =
        coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
          ? `&viewerLat=${encodeURIComponent(coords.lat)}&viewerLng=${encodeURIComponent(coords.lng)}`
          : "";
      const data = await requestJson(
        `/square/posts?limit=${PAGE_SIZE}&offset=${targetOffset}&refresh=${reset ? 1 : 0}${locParams}`
      );
      const incoming = Array.isArray(data.posts) ? data.posts : [];
      const nextOffset = data.nextOffset ?? targetOffset + incoming.length;
      offsetRef.current = nextOffset;
      if (reset) {
        setPosts(incoming);
      } else {
        setPosts((prev) => [...prev, ...incoming]);
      }
      setHasMore(
        typeof data.hasMore === "boolean"
          ? data.hasMore
          : incoming.length > 0 && (data.total ? nextOffset < data.total : true)
      );
    } catch (error) {
      Taro.showToast({ title: error.message || "加载失败", icon: "none" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts(true);
  };

  const onScrollToLower = () => {
    if (hasMore && !loading) loadPosts(false);
  };

  const openProfile = (post) => {
    if (!post.userId) {
      Taro.showToast({ title: "暂无法查看该用户", icon: "none" });
      return;
    }
    Taro.navigateTo({ url: `/pages/peer-profile/index?userId=${encodeURIComponent(post.userId)}` });
  };

  const openChat = (post) => {
    if (!post.userId) {
      Taro.showToast({ title: "暂无法私信该用户", icon: "none" });
      return;
    }
    Taro.navigateTo({
      url: `/pages/chat-room/index?peerId=${encodeURIComponent(post.userId)}&name=${encodeURIComponent(post.nickname || "用户")}`
    });
  };

  return (
    <View className="square-wrap">
      <View className="square-topbar">
        <Text className="square-topbar-title">广场</Text>
        <Text className="square-compose" onClick={() => Taro.navigateTo({ url: "/pages/me-compose/index" })}>＋</Text>
      </View>
      <ScrollView
      className="square-page"
      scrollY
      enhanced
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={onRefresh}
      onScrollToLower={onScrollToLower}
      lowerThreshold={120}
    >
      {posts.length === 0 && !loading ? (
        <View className="square-empty">
          <Text>暂无动态</Text>
        </View>
      ) : null}

      {posts.map((post) => (
        <View key={post.id} className="post-card">
          <View className="post-head" onClick={() => openProfile(post)}>
            <UserAvatar src={post.avatarUrl} size={72} />
            <View className="post-meta">
              <Text className="post-name">{post.nickname || "用户"}</Text>
              <Text className="post-sub">
                {[post.createdAt, formatDistanceKm(post.distanceKm)].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          {post.text ? <Text className="post-text">{post.text}</Text> : null}
          {Array.isArray(post.imageUrls) && post.imageUrls.length ? (
            <View className="post-images">
              {post.imageUrls.slice(0, 3).map((url, i) => (
                <Image key={`${post.id}-img-${i}`} className="post-image" mode="aspectFill" src={resolveAvatarUrl(url)} />
              ))}
            </View>
          ) : null}
          <View className="post-foot">
            <Text className="post-likes">❤ {post.likes || 0}</Text>
            <Text className="post-action" onClick={() => openChat(post)}>
              私信
            </Text>
          </View>
        </View>
      ))}

      <View className="square-footer">
        {loading ? <Text className="muted-text">加载中…</Text> : hasMore ? <Text className="muted-text">上拉加载更多</Text> : <Text className="muted-text">没有更多了</Text>}
      </View>
    </ScrollView>
    </View>
  );
}
