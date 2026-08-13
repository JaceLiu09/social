import { useState } from "react";
import { View, Text, ScrollView, Input, Button } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import UserAvatar from "../../components/UserAvatar";
import { requestJson } from "../../services/api";
import { ensureLoggedIn, ensureProfileOrRedirect } from "../../services/auth";
import { fetchContacts, searchFriends, sendFriendRequest } from "../../services/profile";
import { formatChatTime } from "../../utils/format";
import "./index.scss";

export default function ChatPage() {
  const [tab, setTab] = useState("chat");
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchKey, setSearchKey] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useDidShow(() => {
    if (!ensureLoggedIn()) return;
    if (!ensureProfileOrRedirect()) return;
    loadConversations();
    loadContacts();
  });

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await requestJson("/chat/conversations");
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch (error) {
      Taro.showToast({ title: error.message || "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const data = await fetchContacts();
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (_e) {
      setContacts([]);
    }
  };

  const openRoom = (item) => {
    Taro.navigateTo({
      url: `/pages/chat-room/index?peerId=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name || "聊天")}`
    });
  };

  const doSearch = async () => {
    const q = searchKey.trim();
    if (!q) return;
    try {
      const data = await searchFriends(q);
      setSearchResults(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      Taro.showToast({ title: error.message || "搜索失败", icon: "none" });
    }
  };

  const addFriend = async (userId) => {
    try {
      await sendFriendRequest(userId);
      Taro.showToast({ title: "好友请求已发送", icon: "success" });
    } catch (error) {
      Taro.showToast({ title: error.message || "发送失败", icon: "none" });
    }
  };

  return (
    <View className="chat-page-wrap">
      <View className="chat-tabs">
        <Text className={`chat-tab${tab === "chat" ? " active" : ""}`} onClick={() => setTab("chat")}>消息</Text>
        <Text className={`chat-tab${tab === "contacts" ? " active" : ""}`} onClick={() => setTab("contacts")}>联系人</Text>
        <Text className={`chat-tab${tab === "add" ? " active" : ""}`} onClick={() => setTab("add")}>加好友</Text>
      </View>

      {tab === "chat" ? (
        <ScrollView className="chat-page" scrollY enhanced refresherEnabled onRefresherRefresh={loadConversations}>
          {!loading && !conversations.length ? (
            <View className="chat-empty"><Text>暂无会话</Text><Text className="chat-empty-sub">匹配成功后可直接发消息</Text></View>
          ) : null}
          {conversations.map((item) => (
            <View key={item.id} className="chat-row" onClick={() => openRoom(item)}>
              <UserAvatar src={item.avatar} size={88} />
              <View className="chat-row-main">
                <View className="chat-row-top">
                  <Text className="chat-row-name">{item.name || "用户"}</Text>
                  <Text className="chat-row-time">{formatChatTime(item.time)}</Text>
                </View>
                <View className="chat-row-bottom">
                  <Text className="chat-row-preview">{item.preview || "暂无消息"}</Text>
                  {item.unread > 0 ? <Text className="chat-row-badge">{item.unread > 99 ? "99+" : item.unread}</Text> : null}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {tab === "contacts" ? (
        <ScrollView className="chat-page" scrollY>
          {contacts.map((item) => (
            <View key={item.id} className="chat-row" onClick={() => openRoom({ id: item.id, name: item.name })}>
              <UserAvatar src={item.avatar} size={88} />
              <View className="chat-row-main">
                <Text className="chat-row-name">{item.name}</Text>
                <Text className="chat-row-preview">{item.status || "在线"}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {tab === "add" ? (
        <View className="chat-add">
          <View className="chat-add-bar">
            <Input className="chat-add-input" placeholder="搜索手机号或昵称" value={searchKey} onInput={(e) => setSearchKey(e.detail.value)} />
            <Button className="chat-add-btn" onClick={doSearch}>搜索</Button>
          </View>
          {searchResults.map((u) => (
            <View key={u.id} className="chat-row">
              <UserAvatar src={u.avatarUrl} size={88} />
              <View className="chat-row-main">
                <Text className="chat-row-name">{u.nickname}</Text>
              </View>
              <Button size="mini" onClick={() => addFriend(u.id)}>加好友</Button>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
