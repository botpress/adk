import { type FC, useState } from "react";
import { useSendMessage } from "../context/SendMessageContext";

type ButtonOption = {
  label: string;
  value: string;
};

type Props = {
  options: ButtonOption[];
  messageId?: string;
};

const selectedByMessage = new Map<string, string>();

const ActionButtons: FC<Props> = ({ options, messageId }) => {
  const sendMessage = useSendMessage();
  const prior = messageId ? selectedByMessage.get(messageId) : undefined;
  const [clicked, setClicked] = useState<string | null>(prior ?? null);

  const handleClick = async (option: ButtonOption) => {
    if (clicked) return;
    setClicked(option.value);
    if (messageId) selectedByMessage.set(messageId, option.value);
    try {
      await sendMessage({ type: "text", text: option.value } as any);
    } catch (err) {
      console.error("Failed to send action:", err);
      setClicked(null);
      if (messageId) selectedByMessage.delete(messageId);
    }
  };

  return (
    <div className="action-buttons-container">
      {options.map((option) => (
        <button
          key={option.value}
          className={`action-button ${clicked === option.value ? "action-button-selected" : ""} ${clicked && clicked !== option.value ? "action-button-disabled" : ""}`}
          onClick={() => handleClick(option)}
          disabled={clicked !== null}
        >
          {option.label}
          {clicked === option.value && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginLeft: "6px" }}>
              <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
};

export default ActionButtons;
