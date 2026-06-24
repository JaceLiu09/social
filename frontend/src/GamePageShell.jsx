export default function GamePageShell({
  variant,
  title,
  subtitle,
  Icon,
  onBack,
  sfxEnabled,
  onToggleSfx,
  showMenuHero = false,
  children
}) {
  return (
    <main className={`game-page game-page--${variant}`}>
      <header className="game-page-head">
        <button type="button" className="game-page-back" onClick={onBack}>
          ‹ 返回
        </button>
        <div className="game-page-title-block">
          {Icon ? (
            <div className="game-page-head-icon" aria-hidden="true">
              <Icon />
            </div>
          ) : null}
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="game-page-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {onToggleSfx ? (
          <button type="button" className="game-page-sfx" onClick={onToggleSfx}>
            音效{sfxEnabled ? "开" : "关"}
          </button>
        ) : (
          <span className="game-page-sfx-spacer" />
        )}
      </header>
      {showMenuHero && Icon ? (
        <div className="game-page-hero" aria-hidden="true">
          <div className="game-page-hero-glow" />
          <div className="game-page-hero-icon">
            <Icon />
          </div>
        </div>
      ) : null}
      <div className="game-page-body">{children}</div>
    </main>
  );
}
