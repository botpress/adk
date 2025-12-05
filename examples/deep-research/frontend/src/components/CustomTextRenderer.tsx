import type { FC } from "react";
import type { BlockObjects } from "@botpress/webchat";
import ResearchMessage from "./ResearchMessage";
import type { ResearchData } from "../types/research";

const CustomTextRenderer: FC<BlockObjects["custom"]> = (props) => {
  const url = props.url || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (props as any).data as ResearchData | undefined;

  // Extract message ID from props
  const messageId = (props as { messageId?: string }).messageId;

  // Research messages - handle both URL formats for backwards compatibility
  if ((url === "custom://research_progress" || url === "research") && data) {
    return (
      <ResearchMessage data={data as ResearchData} messageId={messageId} />
    );
  }

  // Fallback
  return null;
};

export default CustomTextRenderer;
