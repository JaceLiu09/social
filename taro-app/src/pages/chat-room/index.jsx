import { useState, useRef } from "react";
import { View, Text, Input, Button, ScrollView, Image } from "@tarojs/components";
import Taro, { useLoad, useDidShow, useDidHide, useUnload } from "@tarojs/taro";
import UserAvatar from "../../components/UserAvatar";
import VoiceBubble from "../../components/VoiceBubble";
import { requestJson } from "../../services/api";
import { ensureLoggedIn, getCurrentUser } from "../../services/auth";
import { chooseAndUploadImage } from "../../services/upload";
import { createVoiceRecorder, uploadAudioFile } from "../../services/voice";
import { fetchGiftCatalog, sendGift } from "../../services/gifts";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

export default function ChatRoomPage() {
  const [peerId, setPeerId] = useState("");
  const [peerName, setPeerName] = useState("聊天");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [gifts, setGifts] = useState([]);
  const [recording, setRecording] = useState(false);
  const pollRef = useRef(null);
  const recorderRef = useRef(null);
  const user = getCurrentUser();

  useLoad((query) => {
    const id = String(query.peerId || "").trim();
    const name = String(query.name || "聊天").trim();
    setPeerId(id);
    setPeerName(name);
    Taro.setNavigationBarTitle({ title: name });
    fetchGiftCatalog().then((d) => setGifts(d.gifts || [])).catch(() => {});

    recorderRef.current = createVoiceRecorder({
      onStart: () => setRecording(true),
      onStop: async (res) => {
        setRecording(false);
        if (!res.tempFilePath) return;
        try {
          Taro.showLoading({ title: "发送语音…", mask: true });
          const uploaded = await uploadAudioFile(res.tempFilePath, `voice-${Date.now()}.mp3`, res.durationSec);
          await sendMessage({
            kind: "AUDIO",
            mediaUrl: uploaded.url,
            audioDurationSec: uploaded.durationSec
          });
          setShowTools(false);
        } catch (error) {
          Taro.showToast({ title: error.message || "语音发送失败", icon: "none" });
        } finally {
          Taro.hideLoading();
        }
      },
      onError: (error) => {
        setRecording(false);
        Taro.showToast({ title: error.message || "录音失败", icon: "none" });
      }
    });
  });

  useDidShow(() => {
    if (!ensureLoggedIn()) return;
    if (!peerId) return;
    loadMessages(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(false), 3000);
  });

  useDidHide(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (recording) recorderRef.current?.stop();
  });

  useUnload(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (recording) recorderRef.current?.stop();
  });

  const loadMessages = async (markRead) => {
    if (!peerId) return;
    try {
      const data = await requestJson(`/chat/messages?peerId=${encodeURIComponent(peerId)}`);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      if (markRead) {
        await requestJson("/chat/read", { method: "POST", data: { peerId } }).catch(() => null);
      }
    } catch (_error) {
      /* silent on poll */
    }
  };

  const sendMessage = async (payload) => {
    if (!peerId || sending) return;
    setSending(true);
    try {
      await requestJson("/chat/messages", {
        method: "POST",
        data: { toUserId: peerId, ...payload }
      });
      setDraft("");
      await loadMessages(false);
    } catch (error) {
      Taro.showToast({ title: error.message || "发送失败", icon: "none" });
    } finally {
      setSending(false);
    }
  };

  const sendText = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage({ text, kind: "TEXT" });
  };

  const sendImage = async () => {
    try {
      const uploaded = await chooseAndUploadImage(1, "CHAT");
      const item = uploaded[0];
      if (!item?.url) return;
      await sendMessage({
        kind: "IMAGE",
        mediaUrl: item.url,
        thumbMediaUrl: item.thumbUrl || item.url
      });
      setShowTools(false);
    } catch (error) {
      Taro.showToast({ title: error.message || "发送图片失败", icon: "none" });
    }
  };

  const startVoiceRecord = () => {
    if (recording || sending) return;
    recorderRef.current?.start().catch((error) => {
      Taro.showToast({ title: error.message || "无法开始录音", icon: "none" });
    });
  };

  const stopVoiceRecord = () => {
    if (!recording) return;
    recorderRef.current?.stop();
  };

  const sendGiftMessage = async (giftId) => {
    try {
      await sendGift(peerId, giftId, 1);
      Taro.showToast({ title: "礼物已送出", icon: "success" });
      setShowTools(false);
      await loadMessages(false);
    } catch (error) {
      Taro.showToast({ title: error.message || "送礼失败", icon: "none" });
    }
  };

  const openProfile = () => {
    Taro.navigateTo({ url: `/pages/peer-profile/index?userId=${encodeURIComponent(peerId)}` });
  };

  const renderBubble = (msg, mine) => {
    if (msg.kind === "IMAGE" && (msg.thumbMediaUrl || msg.mediaUrl)) {
      return (
        <Image className="chat-bubble-image" mode="widthFix" src={resolveAvatarUrl(msg.thumbMediaUrl || msg.mediaUrl)} />
      );
    }
    if (msg.kind === "AUDIO" && msg.mediaUrl) {
      return (
        <VoiceBubble
          messageId={msg.id}
          mediaUrl={msg.mediaUrl}
          durationSec={msg.audioDurationSec}
          mine={mine}
        />
      );
    }
    return <Text>{msg.text}</Text>;
  };

  return (
    <View className="chat-room">
      <View className="chat-room-header">
        <Text className="chat-room-profile" onClick={openProfile}>查看资料</Text>
      </View>
      <ScrollView className="chat-room-scroll" scrollY scrollIntoView={`msg-${messages.length - 1}`}>
        {messages.map((msg, index) => {
          const mine = msg.fromUserId === user?.id;
          return (
            <View key={msg.id} id={`msg-${index}`} className={`chat-bubble-row ${mine ? "chat-bubble-row--mine" : ""}`}>
              {!mine ? <UserAvatar size={64} src="" /> : null}
              <View className={`chat-bubble ${mine ? "chat-bubble--mine" : ""}`}>{renderBubble(msg, mine)}</View>
            </View>
          );
        })}
      </ScrollView>

      {showTools ? (
        <View className="chat-tools">
          <View className="chat-tool" onClick={sendImage}>📷 图片</View>
          <View
            className={`chat-tool chat-tool-voice${recording ? " recording" : ""}`}
            onTouchStart={startVoiceRecord}
            onTouchEnd={stopVoiceRecord}
            onTouchCancel={stopVoiceRecord}
          >
            🎙 {recording ? "松开发送" : "按住说话"}
          </View>
          {gifts.slice(0, 4).map((gift) => (
            <View key={gift.id} className="chat-tool" onClick={() => sendGiftMessage(gift.id)}>
              {gift.emoji || "🎁"} {gift.name}
            </View>
          ))}
        </View>
      ) : null}

      {recording ? <View className="chat-recording-tip">正在录音…</View> : null}

      <View className="chat-composer">
        <Text className="chat-more" onClick={() => setShowTools((v) => !v)}>＋</Text>
        <Input
          className="chat-input"
          value={draft}
          placeholder={`发消息给 ${peerName}`}
          confirmType="send"
          onInput={(e) => setDraft(e.detail.value)}
          onConfirm={sendText}
        />
        <Button className="chat-send" loading={sending} onClick={sendText}>发送</Button>
      </View>
    </View>
  );
}
