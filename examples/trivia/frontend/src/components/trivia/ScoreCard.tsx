import type { FC } from "react";
import type { ScoreData } from "./types";

interface ScoreCardProps {
  data: ScoreData;
}

const ScoreCard: FC<ScoreCardProps> = ({ data }) => {
  const {
    questionIndex,
    totalQuestions,
    correctAnswer,
    yourAnswer,
    yourPoints,
    isCorrect,
    leaderboard,
    isLastQuestion,
    isCreator,
  } = data;

  return (
    <div className="trivia-score">
      {/* Result header */}
      <div className={`score-result ${isCorrect ? "correct" : "incorrect"}`}>
        <span className="result-icon">{isCorrect ? "✓" : "✗"}</span>
        <span className="result-text">
          {isCorrect ? "Correct!" : "Incorrect"}
        </span>
        <span className="result-points">+{yourPoints} points</span>
      </div>

      {/* Answer comparison */}
      <div className="score-answers">
        <div className="answer-row correct-answer">
          <span className="answer-label">Correct answer:</span>
          <span className="answer-value">{correctAnswer}</span>
        </div>
        {yourAnswer && !isCorrect && (
          <div className="answer-row your-answer">
            <span className="answer-label">Your answer:</span>
            <span className="answer-value">{yourAnswer}</span>
          </div>
        )}
      </div>

      {/* Mini leaderboard */}
      <div className="score-leaderboard">
        <div className="leaderboard-header">
          <span>Leaderboard</span>
          <span className="question-progress">
            {questionIndex + 1}/{totalQuestions}
          </span>
        </div>
        <div className="leaderboard-entries">
          {leaderboard.slice(0, 5).map((entry) => (
            <div
              key={entry.username}
              className={`leaderboard-entry ${entry.rank <= 3 ? `rank-${entry.rank}` : ""}`}
            >
              <span className="entry-rank">
                {entry.rank === 1
                  ? "🥇"
                  : entry.rank === 2
                    ? "🥈"
                    : entry.rank === 3
                      ? "🥉"
                      : `#${entry.rank}`}
              </span>
              <span className="entry-name">{entry.username}</span>
              <span className="entry-score">{entry.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next button / waiting */}
      <div className="score-footer">
        {isLastQuestion ? (
          <div className="footer-text">Final results coming up...</div>
        ) : isCreator ? (
          <div className="footer-creator">
            <div className="footer-text">
              Say "next" in chat to continue
            </div>
          </div>
        ) : (
          <div className="footer-waiting">
            <div className="waiting-spinner" />
            <span>Waiting for host...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreCard;
