export default function GamePageShell({
  variant,
  title,
  subtitle,
  Icon,
  onBack,
  sfxEnabled,
  onToggleSfx,
  showMenuHero = false,
  headerLayout = "inline",
  children
}) {
  const stacked = headerLayout === "stacked";

  return (
    <main className={`game-page game-page--${variant}${stacked ? " game-page--stacked-head" : ""}`}>
      <header className={`game-page-head${stacked ? " game-page-head--stacked" : ""}`}>
        {stacked ? (
          <>
            <div className="game-page-toolbar">
              <button type="button" className="game-page-back" onClick={onBack}>
                ‹ 返回
              </button>
              {onToggleSfx ? (
                <button type="button" className="game-page-sfx" onClick={onToggleSfx}>
                  音效{sfxEnabled ? "开" : "关"}
                </button>
              ) : (
                <span className="game-page-sfx-spacer" />
              )}
            </div>
            <div className="game-page-title-block game-page-title-block--hero">
              {Icon ? (
                <div className="game-page-head-icon game-page-head-icon--large" aria-hidden="true">
                  <Icon />
                </div>
              ) : null}
              <div>
                <h1>{title}</h1>
                {subtitle ? <p className="game-page-subtitle">{subtitle}</p> : null}
              </div>
            </div>
          </>
        ) : (
          <>
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
          </>
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
