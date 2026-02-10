/**
 * Maps custom message URLs to specialized components.
 * "subagent" → SubAgentCard (only "start" messages — the card pulls in related steps via context)
 * "step" → legacy plain-text step indicator (backwards compat)
 */
import type { FC } from "react";
import type { BlockObjects } from "@botpress/webchat";
import { useSubAgentContext } from "../context/SubAgentContext";
import SubAgentCard from "./SubAgentCard";

type SubAgentData = {
  type: "start" | "thinking" | "tool" | "end";
  executionId: string;
  agent: string;
  task: string;
  stepCount?: number;
  ts: number;
};

const CustomTextRenderer: FC<BlockObjects["custom"]> = (props) => {
  const url = props.url || "";
  const data = props.data as SubAgentData | undefined;
  const { groups } = useSubAgentContext();

  // Only the "start" message renders a card — useEnrichedMessages already
  // filtered out thinking/tool/end messages from the message list.
  // This check is a safety net in case filtering is bypassed.
  if (url === "subagent" && data?.executionId) {
    if (data.type !== "start") {
      return null;
    }

    const steps = groups.get(data.executionId) || [];
    if (steps.length === 0) return null;

    return <SubAgentCard steps={steps} />;
  }

  // Legacy step indicator (backwards compat)
  if (url === "step") {
    const name = props.name || "";
    return (
      <div className="step-message">
        <span className="step-content bpMessageBlocksBubble">{name}</span>
      </div>
    );
  }

  // Fallback
  return null;
};

export default CustomTextRenderer;
