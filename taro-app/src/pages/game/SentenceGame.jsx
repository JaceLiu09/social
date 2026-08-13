import { useState, useEffect, useRef } from "react";
import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import GamePageShell from "../../components/GamePageShell";
import GameMatchOverlay from "../../components/GameMatchOverlay";
import UserAvatar from "../../components/UserAvatar";
import {
  SENTENCE_TOPIC_META,
  createSentenceChainRounds,
  getSentenceTopicMeta,
  resolveSentencePeerChoice
} from "../../games/sentenceLogic";
import { mapRobotToGameOpponent, randomGameMatchDelayMs } from "../../games/shared";
import { fetchRobotLibraryUser } from "../../services/profile";
import { getCurrentUser } from "../../services/auth";

export default function SentenceGame() {
  const user = getCurrentUser();
  const [mode, setMode] = useState("menu");
  const [topic, setTopic] = useState("date");
  const [matching, setMatching] = useState(false);
  const [matchElapsed, setMatchElapsed] = useState(0);
  const [opponent, setOpponent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [myChoice, setMyChoice] = useState("");
  const [peerChoice, setPeerChoice] = useState("");
  const [score, setScore] = useState(0);
  const [logs, setLogs] = useState([]);
  const [countdown, setCountdown] = useState(20);
  const [resolving, setResolving] = useState(false);
  const robotsRef = useRef([]);
  const matchTimerRef = useRef(null);
  const resolveTimerRef = useRef(null);

  useEffect(() => {
    fetchRobotLibraryUser()
      .then((data) => {
        robotsRef.current = Array.isArray(data.profiles) ? data.profiles : [];
      })
      .catch(() => {
        robotsRef.current = [];
      });
    return () => {
      if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!matching) return undefined;
    const started = Date.now();
    const timer = setInterval(() => setMatchElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [matching]);

  useEffect(() => {
    if (mode !== "playing" || myChoice || resolving) return undefined;
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [mode, countdown, myChoice, resolving]);

  const currentRound = rounds[roundIndex];

  const startGame = (opp) => {
    setOpponent(opp);
    setRounds(createSentenceChainRounds(5, topic));
    setRoundIndex(0);
    setMyChoice("");
    setPeerChoice("");
    setCountdown(20);
    setScore(0);
    setLogs([]);
    setResolving(false);
    setMode("playing");
  };

  const startMatch = () => {
    if (matching) return;
    setMatching(true);
    setMatchElapsed(0);
    matchTimerRef.current = setTimeout(() => {
      const source = robotsRef.current.length
        ? robotsRef.current
        : [{ id: "fallback-bot", nickname: "隐藏款", gender: "FEMALE", avatar: "" }];
      const target = source[Math.floor(Math.random() * source.length)];
      setMatching(false);
      startGame(mapRobotToGameOpponent(target, true));
    }, randomGameMatchDelayMs());
  };

  const resolveRound = (choice) => {
    if (!currentRound || peerChoice || resolving) return;
    setResolving(true);
    const options = currentRound.options || [];
    resolveTimerRef.current = setTimeout(() => {
      const peer = resolveSentencePeerChoice(choice, options, opponent?.isBot);
      setPeerChoice(peer);
      const matched = peer === choice;
      setScore((prev) => prev + (matched ? 20 : 0));
      setLogs((prev) => [
        ...prev,
        `第 ${roundIndex + 1} 题：你选「${choice}」，对方选「${peer}」${matched ? "，默契+20" : ""}`
      ]);
      if (roundIndex >= rounds.length - 1) {
        setMode("result");
        setResolving(false);
        return;
      }
      resolveTimerRef.current = setTimeout(() => {
        setRoundIndex((prev) => prev + 1);
        setMyChoice("");
        setPeerChoice("");
        setCountdown(20);
        setResolving(false);
      }, 1200);
    }, 1200 + Math.floor(Math.random() * 1200));
  };

  const pickChoice = (choice) => {
    if (myChoice || resolving) return;
    setMyChoice(choice);
    resolveRound(choice);
  };

  const openPeer = () => {
    if (!opponent?.id) return;
    Taro.navigateTo({ url: `/pages/peer-profile/index?userId=${encodeURIComponent(opponent.id)}` });
  };

  const openChat = () => {
    if (!opponent?.id) return;
    Taro.navigateTo({
      url: `/pages/chat-room/index?peerId=${encodeURIComponent(opponent.id)}&name=${encodeURIComponent(opponent.name || "用户")}`
    });
  };

  const topicMeta = getSentenceTopicMeta(topic);
  const progress = rounds.length ? Math.round(((roundIndex + (myChoice ? 1 : 0)) / rounds.length) * 100) : 0;

  return (
    <GamePageShell variant="sentence" title="猜句子接龙" subtitle="选出你的下一句，测测同频度" emoji="💬">
      <View className="game-panel">
        <GameMatchOverlay open={matching} elapsedSec={matchElapsed} />
        {mode === "menu" && (
          <View>
            <Text className="game-menu-intro">每局 5 题接龙，选中相同选项即加分，满分 100。</Text>
            <View className="game-topic-grid">
              {SENTENCE_TOPIC_META.map((item) => (
                <View
                  key={item.id}
                  className={`game-topic-card${topic === item.id ? " active" : ""}`}
                  onClick={() => setTopic(item.id)}
                >
                  <Text className="game-topic-emoji">{item.emoji}</Text>
                  <Text className="game-topic-label">{item.label}</Text>
                  <Text className="game-topic-desc">{item.desc}</Text>
                </View>
              ))}
            </View>
            <View className="game-actions">
              <Button className="game-primary-btn" onClick={startMatch} disabled={matching}>
                {matching ? "匹配中..." : "立即匹配"}
              </Button>
            </View>
          </View>
        )}

        {mode === "playing" && currentRound && (
          <View>
            <View className="game-duel-bar">
              <View className="game-duel-player">
                <UserAvatar src={user?.avatarUrl} size={80} />
                <Text className="game-duel-name">{user?.nickname || "我"}</Text>
              </View>
              <View className="game-duel-center">
                <Text>第 {roundIndex + 1}/{rounds.length} 题</Text>
                <Text className="game-duel-vs">VS</Text>
                <Text>{score} 分</Text>
              </View>
              <View className="game-duel-player">
                <UserAvatar src={opponent?.avatar} size={80} />
                <Text className="game-duel-name">{opponent?.name || "对方"}</Text>
              </View>
            </View>
            <View className="game-progress-wrap">
              <View className="game-progress-label">
                <Text>接龙进度</Text>
                <Text>{progress}%</Text>
              </View>
              <View className="game-progress-bar">
                <Text className="game-progress-bar-fill" style={{ width: `${progress}%` }} />
              </View>
            </View>
            <Text className="game-pill">{topicMeta.emoji} {topicMeta.label}</Text>
            <Text className={`game-pill${countdown <= 5 ? " danger" : ""}`}> {countdown}s </Text>
            <Text style={{ display: "block", margin: "20px 0", fontSize: "30px", fontWeight: 600 }}>{currentRound.stem}</Text>
            <View className="game-option-grid">
              {currentRound.options.map((option) => (
                <View
                  key={option}
                  className={`game-option-btn${myChoice === option ? " active" : ""}${peerChoice === option && peerChoice !== myChoice ? " is-peer" : ""}${peerChoice === option && peerChoice === myChoice ? " is-overlap" : ""}`}
                  onClick={() => pickChoice(option)}
                >
                  <Text>{option}</Text>
                </View>
              ))}
            </View>
            {myChoice ? (
              <Text style={{ display: "block", marginTop: "16px", fontSize: "24px", color: "#6b7280" }}>
                {peerChoice
                  ? peerChoice === myChoice
                    ? "双方同频，默契 +20"
                    : `对方选了「${peerChoice}」`
                  : "等待对方选句..."}
              </Text>
            ) : null}
          </View>
        )}

        {mode === "result" && (
          <View>
            <View className="game-result-score">
              <Text className="game-result-score-num">{score}</Text>
              <Text>默契分 / 100</Text>
            </View>
            {logs.map((line, idx) => (
              <Text key={idx} className="game-result-log">{line}</Text>
            ))}
            <Button className="game-secondary-btn" onClick={openPeer}>查看对方资料</Button>
            <Button className="game-secondary-btn" onClick={openChat}>联系对方</Button>
            <Button className="game-primary-btn" onClick={() => { setMode("menu"); startMatch(); }}>再来一局</Button>
          </View>
        )}
      </View>
    </GamePageShell>
  );
}
