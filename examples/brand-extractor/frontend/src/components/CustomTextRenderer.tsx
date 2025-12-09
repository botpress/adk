import type { FC } from "react";
import type { BlockObjects } from "@botpress/webchat";
import BrandMessage from "./BrandMessage";
import type { BrandProgressData } from "../types/brand";

const CustomTextRenderer: FC<BlockObjects["custom"]> = (props) => {
  const url = props.url || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (props as any).data as BrandProgressData | undefined;

  // Extract message ID from props
  const messageId = (props as { messageId?: string }).messageId;

  // Brand extraction messages
  if (url === "custom://brand_progress" && data && messageId) {
    return <BrandMessage data={data} messageId={messageId} />;
  }

  // Fallback
  return null;
};

export default CustomTextRenderer;
