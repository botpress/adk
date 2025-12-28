import type { FC } from "react";
import type { BlockObjects } from "@botpress/webchat";
import {
  LobbyCard,
  QuestionCard,
  ScoreCard,
  LeaderboardCard,
  type LobbyData,
  type QuestionData,
  type ScoreData,
  type LeaderboardData,
} from "./trivia";

const CustomTextRenderer: FC<BlockObjects["custom"]> = (props) => {
  const url = props.url || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (props as any).data;

  // Trivia Lobby
  if (url === "custom://trivia_lobby" && data) {
    return <LobbyCard data={data as LobbyData} />;
  }

  // Trivia Question
  if (url === "custom://trivia_question" && data) {
    return <QuestionCard data={data as QuestionData} />;
  }

  // Trivia Score
  if (url === "custom://trivia_score" && data) {
    return <ScoreCard data={data as ScoreData} />;
  }

  // Trivia Leaderboard
  if (url === "custom://trivia_leaderboard" && data) {
    return <LeaderboardCard data={data as LeaderboardData} />;
  }

  // Fallback
  return null;
};

export default CustomTextRenderer;
