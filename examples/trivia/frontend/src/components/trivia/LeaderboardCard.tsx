import type { FC } from "react";
import type { LeaderboardData } from "./types";

interface LeaderboardCardProps {
  data: LeaderboardData;
}

const LeaderboardCard: FC<LeaderboardCardProps> = ({ data }) => {
  const { leaderboard, onClose } = data;

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return null;
    }
  };

  const winner = leaderboard[0];

  return (
    <div className="trivia-leaderboard">
      {/* Winner celebration */}
      <div className="leaderboard-winner">
        <div className="winner-crown">👑</div>
        <div className="winner-name">{winner?.username}</div>
        <div className="winner-score">{winner?.score} points</div>
        <div className="winner-confetti">🎉</div>
      </div>

      {/* Full leaderboard */}
      <div className="leaderboard-full">
        <div className="leaderboard-title">Final Standings</div>
        <div className="leaderboard-list">
          {leaderboard.map((entry, index) => {
            const medal = getMedalEmoji(entry.rank);
            return (
              <div
                key={entry.username}
                className={`leaderboard-row ${entry.rank <= 3 ? `top-${entry.rank}` : ""}`}
              >
                <div className="row-rank">
                  {medal || <span className="rank-number">#{entry.rank}</span>}
                </div>
                <div className="row-player">
                  <span className="player-avatar">
                    {entry.username.charAt(0).toUpperCase()}
                  </span>
                  <span className="player-name">{entry.username}</span>
                </div>
                <div className="row-score">{entry.score}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Close leaderboard */}
      <div className="leaderboard-footer">
        {onClose && (
          <button className="close-leaderboard-btn" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      {/* Attribution */}
      <div className="leaderboard-attribution">
        Trivia questions from{" "}
        <a
          href="https://opentdb.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Trivia Database
        </a>
        , licensed under{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank"
          rel="noopener noreferrer"
        >
          CC BY-SA 4.0
        </a>
      </div>
    </div>
  );
};

export default LeaderboardCard;
