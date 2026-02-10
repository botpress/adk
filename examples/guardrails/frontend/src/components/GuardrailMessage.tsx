/**
 * Renders a guardrail warning card in the chat when the topic check fails.
 * The data shape (name + message) comes from the custom message payload
 * sent by the bot's onBeforeExecution hook.
 */
import type { FC } from "react";

export interface GuardrailData {
  name: string;
  message: string;
}

interface GuardrailMessageProps {
  data: GuardrailData;
}

const GuardrailMessage: FC<GuardrailMessageProps> = ({ data }) => {
  return (
    <div className="guardrail-message">
      <div className="guardrail-header">
        <svg
          className="guardrail-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M3.586 12 12 3.586 20.414 12 12 20.414z" />
        </svg>
        <span className="guardrail-name">{data.name}</span>
      </div>
      <p className="guardrail-text">{data.message}</p>
    </div>
  );
};

export default GuardrailMessage;
