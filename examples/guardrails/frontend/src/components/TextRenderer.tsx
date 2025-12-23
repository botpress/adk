import type { FC } from "react";
import type { BlockObjects } from "@botpress/webchat";
import { renderers } from "@botpress/webchat";

const TextRenderer: FC<BlockObjects["bubble"]> = (props) => {
  const DefaultBubbleRenderer = renderers.bubble;
  return <DefaultBubbleRenderer {...props} />;
};

export default TextRenderer;
