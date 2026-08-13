import { useLoad } from "@tarojs/taro";
import { useState } from "react";
import { View } from "@tarojs/components";
import { ensureLoggedIn } from "../../services/auth";
import SentenceGame from "./SentenceGame";
import CommonGroundGame from "./CommonGroundGame";
import TruthGame from "./TruthGame";
import TacitGame from "./TacitGame";

export default function GamePage() {
  const [gameId, setGameId] = useState("");

  useLoad((query) => {
    if (!ensureLoggedIn()) return;
    setGameId(String(query.game || "").trim());
  });

  if (gameId === "sentence") return <SentenceGame />;
  if (gameId === "commonground") return <CommonGroundGame />;
  if (gameId === "truth") return <TruthGame />;
  if (gameId === "tacit") return <TacitGame />;

  return <View />;
}
