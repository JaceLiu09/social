export default function GameMatchOverlay({ open, countdown, tip = "正在为你寻找同频玩家" }) {
  if (!open) return null;
  return (
    <div className="game-match-overlay" role="dialog" aria-modal="true" aria-labelledby="game-match-title" aria-busy="true">
      <div className="game-match-modal">
        <p id="game-match-title" className="game-match-label">
          正在匹配
        </p>
        <div className="game-match-count" aria-hidden="true">
          {countdown > 0 ? countdown : "·"}
        </div>
        <p className="game-match-tip">{tip}</p>
      </div>
    </div>
  );
}
