import { useState, useEffect, type FC } from "react";
import type { GameSettings } from "../../types/game-settings";
import { CATEGORY_OPTIONS, SCORE_METHOD_OPTIONS } from "../../types/game-settings";

interface GameStartSplashProps {
  settings: GameSettings;
  onComplete: () => void;
  /** Countdown duration in seconds (default: 5) */
  countdownSeconds?: number;
}

const GameStartSplash: FC<GameStartSplashProps> = ({
  settings,
  onComplete,
  countdownSeconds = 5,
}) => {
  const [countdown, setCountdown] = useState(countdownSeconds);

  useEffect(() => {
    if (countdown <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onComplete]);

  // Get category labels
  const categoryLabels = settings.categories.includes("any")
    ? "Any Category"
    : settings.categories
        .map((cat) => CATEGORY_OPTIONS.find((c) => c.value === cat)?.label || cat)
        .join(", ");

  // Get difficulty label
  const difficultyLabel =
    settings.difficulties.length === 3
      ? "All Difficulties"
      : settings.difficulties
          .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
          .join(", ");

  // Get score method label
  const scoreMethod = SCORE_METHOD_OPTIONS.find(
    (s) => s.value === settings.scoreMethod
  );

  return (
    <div className="game-start-splash">
      <div className="splash-content">
        {/* Animated title */}
        <div className="splash-title">
          <span className="title-emoji">🎮</span>
          <h1>Game Starting!</h1>
        </div>

        {/* Settings summary */}
        <div className="splash-settings">
          <div className="settings-grid">
            <div className="setting-row">
              <span className="setting-icon">📚</span>
              <div className="setting-info">
                <span className="setting-label">Categories</span>
                <span className="setting-value">{categoryLabels}</span>
              </div>
            </div>

            <div className="setting-row">
              <span className="setting-icon">📊</span>
              <div className="setting-info">
                <span className="setting-label">Difficulty</span>
                <span className="setting-value">{difficultyLabel}</span>
              </div>
            </div>

            <div className="setting-row">
              <span className="setting-icon">❓</span>
              <div className="setting-info">
                <span className="setting-label">Questions</span>
                <span className="setting-value">{settings.questionCount} questions</span>
              </div>
            </div>

            <div className="setting-row">
              <span className="setting-icon">⏱️</span>
              <div className="setting-info">
                <span className="setting-label">Timer</span>
                <span className="setting-value">{settings.timerSeconds} seconds per question</span>
              </div>
            </div>

            <div className="setting-row">
              <span className="setting-icon">🏆</span>
              <div className="setting-info">
                <span className="setting-label">Scoring</span>
                <span className="setting-value">
                  {scoreMethod?.label || settings.scoreMethod}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="splash-countdown">
          <div className="countdown-ring">
            <svg viewBox="0 0 100 100">
              <circle
                className="countdown-bg"
                cx="50"
                cy="50"
                r="45"
              />
              <circle
                className="countdown-progress"
                cx="50"
                cy="50"
                r="45"
                style={{
                  strokeDasharray: `${(countdown / countdownSeconds) * 283} 283`,
                }}
              />
            </svg>
            <span className="countdown-number">{countdown}</span>
          </div>
          <p className="countdown-text">Get Ready!</p>
        </div>
      </div>
    </div>
  );
};

export default GameStartSplash;
