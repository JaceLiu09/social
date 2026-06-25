function GameCardSvg({ children }) {
  return (
    <svg className="game-card-svg" viewBox="0 0 48 48" aria-hidden="true">
      {children}
    </svg>
  );
}

export function PlanetGameSentenceIcon() {
  return (
    <GameCardSvg>
      <path
        d="M7 13h19a5 5 0 015 5v9a5 5 0 01-5 5h-8l-6 5v-5H7a5 5 0 01-5-5V18a5 5 0 015-5z"
        fill="#fff"
        opacity="0.95"
      />
      <path
        d="M19 21h19a5 5 0 015 5v7a5 5 0 01-5 5h-7l-5 4v-4H19a5 5 0 01-5-5v-7a5 5 0 015-5z"
        fill="#fff"
        opacity="0.72"
      />
      <circle cx="13" cy="23" r="1.6" fill="#2f8fff" />
      <circle cx="18.5" cy="23" r="1.6" fill="#2f8fff" />
      <circle cx="24" cy="23" r="1.6" fill="#2f8fff" />
    </GameCardSvg>
  );
}

export function PlanetGameCommonGroundIcon() {
  return (
    <GameCardSvg>
      <path
        d="M24 8l4.2 8.5 9.4 1.4-6.8 6.6 1.6 9.3L24 29.8l-8.4 4.4 1.6-9.3-6.8-6.6 9.4-1.4L24 8z"
        fill="#fff"
        opacity="0.95"
      />
      <circle cx="14" cy="34" r="5.5" fill="#fff" opacity="0.88" />
      <circle cx="34" cy="34" r="5.5" fill="#fff" opacity="0.72" />
      <path d="M12.5 34h3M31.5 34h3" stroke="#2bb673" strokeWidth="1.8" strokeLinecap="round" />
    </GameCardSvg>
  );
}

export function PlanetGameTruthIcon() {
  return (
    <GameCardSvg>
      <path
        d="M24 37.5S9 28.5 9 19.2C9 14.8 12.3 11.5 16.4 11.5c2.4 0 4.6 1.1 6.2 2.9 1.6-1.8 3.8-2.9 6.2-2.9 4.1 0 7.4 3.3 7.4 7.7 0 9.3-12 18.3-12 18.3z"
        fill="#fff"
      />
      <text x="24" y="24.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ff4f86">
        ?
      </text>
    </GameCardSvg>
  );
}

export function PlanetGameTacitIcon() {
  return (
    <GameCardSvg>
      <rect x="7" y="11" width="15" height="26" rx="4.5" fill="#fff" opacity="0.95" />
      <rect x="26" y="11" width="15" height="26" rx="4.5" fill="#fff" opacity="0.78" />
      <text x="14.5" y="28.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ff6b35">
        A
      </text>
      <text x="33.5" y="28.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ff6b35">
        B
      </text>
    </GameCardSvg>
  );
}

export const GAME_ROUTES = {
  "/planet/games/sentence": "sentence",
  "/planet/games/commonground": "commonground",
  "/planet/games/truth": "truth",
  "/planet/games/tacit": "tacit"
};

export const GAME_PATH_BY_ID = {
  sentence: "/planet/games/sentence",
  commonground: "/planet/games/commonground",
  truth: "/planet/games/truth",
  tacit: "/planet/games/tacit"
};

export const PLANET_MATCH_GAMES = [
  {
    id: "sentence",
    title: "猜句子接龙",
    players: "15.1万人正在玩",
    variant: "sentence",
    Icon: PlanetGameSentenceIcon
  },
  {
    id: "commonground",
    title: "共同点探宝",
    players: "8.2万人正在玩",
    variant: "commonground",
    badge: "新品",
    Icon: PlanetGameCommonGroundIcon
  },
  {
    id: "truth",
    title: "真心话挑战",
    desc: "掷骰选题，撩出真心话",
    players: "1.5万人正在玩",
    variant: "truth",
    Icon: PlanetGameTruthIcon
  },
  {
    id: "tacit",
    title: "二选一默契挑战",
    desc: "10道二选一，测测暧昧默契",
    players: "6.5万人正在玩",
    variant: "tacit",
    Icon: PlanetGameTacitIcon
  }
];
