import { useEffect, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import { playVoice, stopVoice } from "../../services/voice";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

export default function VoiceBubble({ messageId, mediaUrl, durationSec = 0, mine = false }) {
  const [playing, setPlaying] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopVoice(messageId);
    };
  }, [messageId]);

  const togglePlay = async () => {
    if (playing) {
      stopVoice(messageId);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    try {
      await playVoice(resolveAvatarUrl(mediaUrl), messageId);
    } catch (_error) {
      /* ignore */
    } finally {
      if (mountedRef.current) setPlaying(false);
    }
  };

  return (
    <View className={`voice-bubble${mine ? " voice-bubble--mine" : ""}${playing ? " voice-bubble--playing" : ""}`} onClick={togglePlay}>
      <Text className="voice-bubble-icon">{playing ? "⏸" : "▶"}</Text>
      <View className="voice-bubble-waves">
        <Text className="voice-wave" />
        <Text className="voice-wave" />
        <Text className="voice-wave" />
      </View>
      <Text className="voice-bubble-dur">{durationSec || 1}"</Text>
    </View>
  );
}
