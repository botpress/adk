import type { FC } from "react";
import type { LobbyData } from "./types";

interface LobbyCardProps {
  data: LobbyData;
}

const LobbyCard: FC<LobbyCardProps> = ({ data }) => {
  const { joinCode, players, settings, isCreator, canStart, newPlayer } = data;

  const copyJoinCode = () => {
    navigator.clipboard.writeText(joinCode);
  };

  const scoreMethodLabels: Record<string, string> = {
    "first-right": "First Right",
    "time-right": "Speed Matters",
    "all-right": "Everyone Scores",
  };

  return (
    <div className="trivia-lobby">
      {/* Join Code */}
      <div className="lobby-code-section">
        <div className="lobby-code-label">Join Code</div>
        <button className="lobby-code" onClick={copyJoinCode} title="Click to copy">
          {joinCode}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <div className="lobby-code-hint">Share this code with friends!</div>
      </div>

      {/* New player notification */}
      {newPlayer && (
        <div className="lobby-notification">
          <span className="notification-emoji">🎉</span>
          <span>{newPlayer} joined the game!</span>
        </div>
      )}

      {/* Players */}
      <div className="lobby-section">
        <div className="lobby-section-header">
          <span>Players ({players.length}/20)</span>
        </div>
        <div className="lobby-players">
          {players.map((player, index) => (
            <div key={player.visibleUserId} className="lobby-player">
              <span className="player-avatar">
                {player.username.charAt(0).toUpperCase()}
              </span>
              <span className="player-name">{player.username}</span>
              {player.isCreator && <span className="player-badge">Host</span>}
              {index === players.length - 1 && players.length > 1 && (
                <span className="player-new">new</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="lobby-section">
        <div className="lobby-section-header">
          <span>Game Settings</span>
          {isCreator && <span className="settings-hint">Chat to change</span>}
        </div>
        <div className="lobby-settings">
          <div className="setting-item">
            <span className="setting-label">Questions</span>
            <span className="setting-value">{settings.questionCount}</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Difficulty</span>
            <span className="setting-value capitalize">{settings.difficulty}</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Timer</span>
            <span className="setting-value">{settings.timerSeconds}s</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Scoring</span>
            <span className="setting-value">
              {scoreMethodLabels[settings.scoreMethod]}
            </span>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="lobby-status">
        {isCreator ? (
          canStart ? (
            <div className="status-ready">
              <span className="status-icon">✓</span>
              Ready to start! Say "start game" in chat.
            </div>
          ) : (
            <div className="status-waiting">
              Waiting for more players... (minimum 2)
            </div>
          )
        ) : (
          <div className="status-waiting">
            Waiting for host to start the game...
          </div>
        )}
      </div>
    </div>
  );
};

export default LobbyCard;
