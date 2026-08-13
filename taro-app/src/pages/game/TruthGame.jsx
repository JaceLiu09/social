import { useState, useEffect, useRef } from "react";
import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import GamePageShell from "../../components/GamePageShell";
import GameMatchOverlay from "../../components/GameMatchOverlay";
import UserAvatar from "../../components/UserAvatar";
import {
  TRUTH_STYLE_OPTIONS,
  TRUTH_ROUNDS_PER_GAME,
  createTruthRounds,
  rollTruthDice,
  getTruthStyleMeta
} from "../../games/truthLogic";
import { mapRobotToGameOpponent, randomGameMatchDelayMs, pickRandomItem } from "../../games/shared";
import { fetchRobotLibraryUser } from "../../services/profile";
import { getCurrentUser } from "../../services/auth";

export default function TruthGame() {
  const user = getCurrentUser();
  const [mode, setMode] = useState("menu");
  const [styleId, setStyleId] = useState("FLIRT");
  const [matching, setMatching] = useState(false);
  const [matchElapsed, setMatchElapsed] = useState(0);
  const [opponent, setOpponent] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState("dice");
  const [dice, setDice] = useState(null);
  const [questionOptions, setQuestionOptions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [myAnswer, setMyAnswer] = useState("");
  const [peerAnswer, setPeerAnswer] = useState("");
  const [logs, setLogs] = useState([]);
  const robotsRef = useRef([]);

  useEffect(() => {
    fetchRobotLibraryUser().then((d) => { robotsRef.current = d.profiles || []; }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!matching) return undefined;
    const started = Date.now();
    const t = setInterval(() => setMatchElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [matching]);

  const styleMeta = getTruthStyleMeta(styleId);

  const startGame = (opp) => {
    setOpponent(opp);
    setRounds(createTruthRounds(TRUTH_ROUNDS_PER_GAME, styleId));
    setRoundIndex(0);
    setLogs([]);
    setMode("playing");
    beginRound(0);
  };

  const beginRound = (idx, roundList = rounds) => {
    const list = roundList.length ? roundList : createTruthRounds(TRUTH_ROUNDS_PER_GAME, styleId);
    const current = list[idx];
    if (!current) {
      setMode("result");
      return;
    }
    setPhase("dice");
    setDice(null);
    setCurrentQuestion(null);
    setMyAnswer("");
    setPeerAnswer("");
    setQuestionOptions([current, ...list.filter((_, i) => i !== idx).slice(0, 2)]);
    setTimeout(() => {
      const rolled = rollTruthDice();
      setDice(rolled);
      setPhase("pick");
    }, 1000);
  };

  const startMatch = () => {
    if (matching) return;
    setMatching(true);
    setTimeout(() => {
      const source = robotsRef.current.length ? robotsRef.current : [{ id: "bot", nickname: "隐藏款", gender: "FEMALE" }];
      setMatching(false);
      const rs = createTruthRounds(TRUTH_ROUNDS_PER_GAME, styleId);
      setRounds(rs);
      startGame(mapRobotToGameOpponent(source[Math.floor(Math.random() * source.length)], true));
    }, randomGameMatchDelayMs());
  };

  const pickQuestion = (q) => {
    if (phase !== "pick" || currentQuestion) return;
    setCurrentQuestion(q);
    setPhase("answer");
    setTimeout(() => {
      const answer = pickRandomItem(q.options, q.options[0]);
      setMyAnswer(answer);
      setTimeout(() => {
        const peer = pickRandomItem(q.options, q.options[0]);
        setPeerAnswer(peer);
        setLogs((prev) => [...prev, `第 ${roundIndex + 1} 题：${q.question} · 你选「${answer}」· 对方选「${peer}」`]);
        setPhase("review");
        setTimeout(() => {
          if (roundIndex >= rounds.length - 1) {
            setMode("result");
            return;
          }
          const next = roundIndex + 1;
          setRoundIndex(next);
          beginRound(next);
        }, 1500);
      }, 1200);
    }, 800);
  };

  return (
    <GamePageShell variant="truth" title="真心话挑战" subtitle="掷骰选题，撩出真心话" emoji="❤️">
      <View className="game-panel">
        <GameMatchOverlay open={matching} elapsedSec={matchElapsed} />
        {mode === "menu" && (
          <View>
            <Text className="game-menu-intro">每局 {TRUTH_ROUNDS_PER_GAME} 题，掷骰决定选题权。</Text>
            <View className="game-topic-grid">
              {TRUTH_STYLE_OPTIONS.map((item) => (
                <View key={item.id} className={`game-topic-card${styleId === item.id ? " active" : ""}`} onClick={() => setStyleId(item.id)}>
                  <Text className="game-topic-emoji">{item.emoji}</Text>
                  <Text className="game-topic-label">{item.label}</Text>
                  <Text className="game-topic-desc">{item.desc}</Text>
                </View>
              ))}
            </View>
            <Button className="game-primary-btn" onClick={startMatch}>立即匹配</Button>
          </View>
        )}

        {mode === "playing" && (
          <View>
            <View className="game-duel-bar">
              <View className="game-duel-player"><UserAvatar src={user?.avatarUrl} size={80} /><Text className="game-duel-name">{user?.nickname || "我"}</Text></View>
              <View className="game-duel-center"><Text>第 {roundIndex + 1}/{rounds.length || TRUTH_ROUNDS_PER_GAME}</Text><Text className="game-duel-vs">{styleMeta.emoji}</Text></View>
              <View className="game-duel-player"><UserAvatar src={opponent?.avatar} size={80} /><Text className="game-duel-name">{opponent?.name}</Text></View>
            </View>
            {phase === "dice" && <Text className="game-intro-overlay">🎲</Text>}
            {dice && phase !== "dice" ? (
              <Text style={{ display: "block", textAlign: "center", marginBottom: "16px" }}>
                骰子 {dice.diceA} vs {dice.diceB} · {dice.meLose ? "对方选题" : "你来选题"}
              </Text>
            ) : null}
            {phase === "pick" && !currentQuestion ? (
              <View className="game-option-grid">
                {questionOptions.map((q) => (
                  <View key={q.id} className="game-option-btn" onClick={() => pickQuestion(q)}>
                    <Text>{q.question}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {currentQuestion && (
              <View>
                <Text style={{ display: "block", fontSize: "30px", fontWeight: 600, marginBottom: "16px" }}>{currentQuestion.question}</Text>
                <View className="game-option-grid">
                  {currentQuestion.options.map((opt) => (
                    <View key={opt} className={`game-option-btn${myAnswer === opt ? " is-mine" : peerAnswer === opt ? " is-peer" : ""}`}>
                      <Text>{opt}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {mode === "result" && (
          <View>
            <Text style={{ display: "block", textAlign: "center", fontSize: "32px", fontWeight: 600, marginBottom: "16px" }}>挑战完成</Text>
            {logs.map((line, i) => (<Text key={i} className="game-result-log">{line}</Text>))}
            <Button className="game-primary-btn" onClick={() => { setMode("menu"); startMatch(); }}>再来一局</Button>
          </View>
        )}
      </View>
    </GamePageShell>
  );
}
