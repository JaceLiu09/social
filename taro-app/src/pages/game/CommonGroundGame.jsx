import { useState, useEffect, useRef } from "react";
import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import GamePageShell from "../../components/GamePageShell";
import GameMatchOverlay from "../../components/GameMatchOverlay";
import UserAvatar from "../../components/UserAvatar";
import {
  COMMON_GROUND_ROUNDS,
  COMMON_GROUND_MAX_PICK,
  COMMON_GROUND_TOPIC_META,
  createCommonGroundRounds,
  getCommonGroundTopicMeta,
  scoreCommonGroundRound,
  simulateCommonGroundBotPicks,
  countOverlap
} from "../../games/commonGroundGame";
import { mapRobotToGameOpponent, randomGameMatchDelayMs } from "../../games/shared";
import { fetchRobotLibraryUser } from "../../services/profile";
import { getCurrentUser } from "../../services/auth";

export default function CommonGroundGame() {
  const user = getCurrentUser();
  const [mode, setMode] = useState("menu");
  const [topic, setTopic] = useState("love");
  const [matching, setMatching] = useState(false);
  const [matchElapsed, setMatchElapsed] = useState(0);
  const [opponent, setOpponent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [draftPicks, setDraftPicks] = useState([]);
  const [myPicks, setMyPicks] = useState([]);
  const [peerPicks, setPeerPicks] = useState([]);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(25);
  const [resolving, setResolving] = useState(false);
  const robotsRef = useRef([]);
  const matchTimerRef = useRef(null);

  useEffect(() => {
    fetchRobotLibraryUser().then((d) => { robotsRef.current = d.profiles || []; }).catch(() => {});
    return () => { if (matchTimerRef.current) clearTimeout(matchTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!matching) return undefined;
    const started = Date.now();
    const t = setInterval(() => setMatchElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [matching]);

  useEffect(() => {
    if (mode !== "playing" || myPicks.length || peerPicks.length || resolving) return undefined;
    if (countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, countdown, myPicks.length, peerPicks.length, resolving]);

  const currentRound = rounds[roundIndex];
  const overlap = countOverlap(myPicks, peerPicks);
  const topicMeta = getCommonGroundTopicMeta(topic);
  const progress = rounds.length ? Math.round(((roundIndex + (myPicks.length ? 1 : 0)) / rounds.length) * 100) : 0;

  const startGame = (opp) => {
    setOpponent(opp);
    setRounds(createCommonGroundRounds(COMMON_GROUND_ROUNDS, topic));
    setRoundIndex(0);
    setDraftPicks([]);
    setMyPicks([]);
    setPeerPicks([]);
    setCountdown(25);
    setScore(0);
    setResolving(false);
    setMode("playing");
  };

  const startMatch = () => {
    if (matching) return;
    setMatching(true);
    matchTimerRef.current = setTimeout(() => {
      const source = robotsRef.current.length ? robotsRef.current : [{ id: "bot", nickname: "隐藏款", gender: "FEMALE" }];
      setMatching(false);
      startGame(mapRobotToGameOpponent(source[Math.floor(Math.random() * source.length)], true));
    }, randomGameMatchDelayMs());
  };

  const togglePick = (option) => {
    if (myPicks.length || peerPicks.length || resolving) return;
    setDraftPicks((prev) => {
      if (prev.includes(option)) return prev.filter((x) => x !== option);
      if (prev.length >= COMMON_GROUND_MAX_PICK) return prev;
      return [...prev, option];
    });
  };

  const confirmPicks = () => {
    if (!draftPicks.length || !currentRound || resolving) return;
    setMyPicks(draftPicks);
    setResolving(true);
    setTimeout(() => {
      const peer = simulateCommonGroundBotPicks(draftPicks, currentRound.options, opponent?.isBot);
      setPeerPicks(peer);
      const gained = scoreCommonGroundRound(draftPicks, peer);
      setScore((s) => s + gained);
      setTimeout(() => {
        if (roundIndex >= rounds.length - 1) {
          setMode("result");
          setResolving(false);
          return;
        }
        setRoundIndex((i) => i + 1);
        setDraftPicks([]);
        setMyPicks([]);
        setPeerPicks([]);
        setCountdown(25);
        setResolving(false);
      }, 1500);
    }, 1200);
  };

  return (
    <GamePageShell variant="commonground" title="共同点探宝" subtitle="多选题找共同点" emoji="⭐">
      <View className="game-panel">
        <GameMatchOverlay open={matching} elapsedSec={matchElapsed} />
        {mode === "menu" && (
          <View>
            <Text className="game-menu-intro">每局 {COMMON_GROUND_ROUNDS} 题，选中相同选项即得分。</Text>
            <View className="game-topic-grid">
              {COMMON_GROUND_TOPIC_META.map((item) => (
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

        {mode === "playing" && currentRound && (
          <View>
            <View className="game-duel-bar">
              <View className="game-duel-player"><UserAvatar src={user?.avatarUrl} size={80} /><Text className="game-duel-name">{user?.nickname || "我"}</Text></View>
              <View className="game-duel-center"><Text>第 {roundIndex + 1}/{rounds.length} 题</Text><Text className="game-duel-vs">{score} 分</Text></View>
              <View className="game-duel-player"><UserAvatar src={opponent?.avatar} size={80} /><Text className="game-duel-name">{opponent?.name}</Text></View>
            </View>
            <View className="game-progress-wrap">
              <View className="game-progress-label"><Text>探宝进度</Text><Text>{progress}%</Text></View>
              <View className="game-progress-bar"><Text className="game-progress-bar-fill" style={{ width: `${progress}%` }} /></View>
            </View>
            <Text className="game-pill">{topicMeta.emoji} {topicMeta.label}</Text>
            <Text style={{ display: "block", margin: "16px 0", fontSize: "30px", fontWeight: 600 }}>{currentRound.prompt}</Text>
            <Text className="muted-text">{peerPicks.length ? `共同点 ${overlap.length} 个` : `可选 1-${COMMON_GROUND_MAX_PICK} 项 · ${countdown}s`}</Text>
            <View className="game-option-grid">
              {currentRound.options.map((option) => {
                const isMine = myPicks.includes(option) || (!myPicks.length && draftPicks.includes(option));
                const isPeer = peerPicks.includes(option);
                const isOverlap = isMine && isPeer;
                return (
                  <View
                    key={option}
                    className={`game-option-btn${isOverlap ? " is-overlap" : isMine ? " is-mine" : isPeer ? " is-peer" : ""}`}
                    onClick={() => togglePick(option)}
                  >
                    <Text>{option}{isOverlap ? " · 共同点" : ""}</Text>
                  </View>
                );
              })}
            </View>
            {!myPicks.length && !peerPicks.length ? (
              <Button className="game-primary-btn" disabled={!draftPicks.length || resolving} onClick={confirmPicks}>
                确认选择（{draftPicks.length}/{COMMON_GROUND_MAX_PICK}）
              </Button>
            ) : null}
          </View>
        )}

        {mode === "result" && (
          <View>
            <View className="game-result-score"><Text className="game-result-score-num">{score}</Text><Text>共同点得分</Text></View>
            <Button className="game-primary-btn" onClick={() => { setMode("menu"); startMatch(); }}>再来一局</Button>
          </View>
        )}
      </View>
    </GamePageShell>
  );
}
