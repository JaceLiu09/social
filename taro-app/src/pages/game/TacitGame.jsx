import { useState, useEffect, useRef } from "react";
import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import GamePageShell from "../../components/GamePageShell";
import GameMatchOverlay from "../../components/GameMatchOverlay";
import UserAvatar from "../../components/UserAvatar";
import { TACIT_TOPIC_META, getTacitTopicMeta } from "../../games/tacitGame";
import {
  enqueueTacitMatch,
  fetchTacitMatchStatus,
  cancelTacitMatch,
  fetchTacitRoom,
  answerTacitQuestion
} from "../../services/tacit";
import { getCurrentUser } from "../../services/auth";

export default function TacitGame() {
  const user = getCurrentUser();
  const [mode, setMode] = useState("menu");
  const [topic, setTopic] = useState("love");
  const [matching, setMatching] = useState(false);
  const [matchElapsed, setMatchElapsed] = useState(0);
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState(null);
  const [draftChoice, setDraftChoice] = useState("");
  const pollRef = useRef(null);

  const topicMeta = getTacitTopicMeta(topic);
  const currentQuestion = room?.questions?.find((q) => !q.done) || null;
  const myMember = room?.members?.find((m) => m.userId === user?.id);
  const peerMember = room?.members?.find((m) => m.userId !== user?.id);
  const progress = room?.questionCount
    ? Math.round(((room.finishedCount || 0) / room.questionCount) * 100)
    : 0;

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    if (!matching) return undefined;
    const started = Date.now();
    const t = setInterval(() => setMatchElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [matching]);

  const refreshRoom = async (id = roomId) => {
    if (!id) return;
    const data = await fetchTacitRoom(id);
    const payload = data.room || data;
    setRoom(payload);
    if (payload?.status === "FINISHED") setMode("result");
    else if (payload?.status === "IN_PROGRESS") setMode("playing");
  };

  const startPolling = (id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => refreshRoom(id).catch(() => null), 2500);
  };

  const startMatch = async () => {
    if (matching) return;
    setMatching(true);
    setMatchElapsed(0);
    try {
      const data = await enqueueTacitMatch(topic);
      if (data.matched && data.roomId) {
        setRoomId(data.roomId);
        setRoom(data.room);
        setMatching(false);
        setMode("playing");
        startPolling(data.roomId);
        return;
      }
      const pollMatch = setInterval(async () => {
        try {
          const status = await fetchTacitMatchStatus();
          if (status.matched && status.roomId) {
            clearInterval(pollMatch);
            setRoomId(status.roomId);
            setRoom(status.room);
            setMatching(false);
            setMode("playing");
            startPolling(status.roomId);
          }
        } catch (_e) {
          /* keep polling */
        }
      }, 2000);
      setTimeout(() => {
        clearInterval(pollMatch);
        if (matching) {
          cancelTacitMatch().catch(() => null);
          setMatching(false);
          Taro.showToast({ title: "匹配超时，请重试", icon: "none" });
        }
      }, 30000);
    } catch (error) {
      setMatching(false);
      Taro.showToast({ title: error.message || "匹配失败", icon: "none" });
    }
  };

  const submitAnswer = async (choice) => {
    if (!roomId || !currentQuestion?.id || !choice) return;
    try {
      await answerTacitQuestion(roomId, currentQuestion.id, choice);
      setDraftChoice("");
      await refreshRoom();
    } catch (error) {
      Taro.showToast({ title: error.message || "提交失败", icon: "none" });
    }
  };

  return (
    <GamePageShell variant="tacit" title="二选一默契挑战" subtitle="10 道二选一，测测暧昧默契" emoji="🎯">
      <View className="game-panel">
        <GameMatchOverlay open={matching} elapsedSec={matchElapsed} tip="正在匹配真人或机器人对手" />
        {mode === "menu" && (
          <View>
            <Text className="game-menu-intro">真实联机匹配，选中相同选项得分。</Text>
            <View className="game-topic-grid">
              {TACIT_TOPIC_META.map((item) => (
                <View key={item.id} className={`game-topic-card${topic === item.id ? " active" : ""}`} onClick={() => setTopic(item.id)}>
                  <Text className="game-topic-emoji">{item.emoji}</Text>
                  <Text className="game-topic-label">{item.label}</Text>
                  <Text className="game-topic-desc">{item.desc}</Text>
                </View>
              ))}
            </View>
            <Button className="game-primary-btn" onClick={startMatch}>{matching ? "匹配中..." : "立即匹配"}</Button>
          </View>
        )}

        {mode === "playing" && currentQuestion && (
          <View>
            <View className="game-duel-bar">
              <View className="game-duel-player"><UserAvatar src={user?.avatarUrl} size={80} /><Text className="game-duel-name">{user?.nickname || "我"}</Text></View>
              <View className="game-duel-center"><Text>{topicMeta.label}</Text><Text className="game-duel-vs">{room?.score ?? 0} 分</Text></View>
              <View className="game-duel-player"><UserAvatar src={peerMember?.avatarUrl} size={80} /><Text className="game-duel-name">{peerMember?.nickname || "对方"}</Text></View>
            </View>
            <View className="game-progress-wrap">
              <View className="game-progress-label"><Text>默契进度</Text><Text>{progress}%</Text></View>
              <View className="game-progress-bar"><Text className="game-progress-bar-fill" style={{ width: `${progress}%` }} /></View>
            </View>
            <Text style={{ display: "block", fontSize: "30px", fontWeight: 600, margin: "16px 0" }}>{currentQuestion.prompt}</Text>
            <View className="game-option-grid">
              {[
                { key: "A", label: currentQuestion.optionA },
                { key: "B", label: currentQuestion.optionB }
              ].map((opt) => (
                <View key={opt.key} className={`game-option-btn${draftChoice === opt.key ? " active" : ""}`} onClick={() => setDraftChoice(opt.key)}>
                  <Text>{opt.label}</Text>
                </View>
              ))}
            </View>
            <Button className="game-primary-btn" disabled={!draftChoice} onClick={() => submitAnswer(draftChoice)}>确认选择</Button>
          </View>
        )}

        {mode === "result" && (
          <View>
            <View className="game-result-score"><Text className="game-result-score-num">{room?.score ?? 0}</Text><Text>默契分</Text></View>
            <Button className="game-primary-btn" onClick={() => { setMode("menu"); setRoom(null); setRoomId(""); startMatch(); }}>再来一局</Button>
          </View>
        )}
      </View>
    </GamePageShell>
  );
}
