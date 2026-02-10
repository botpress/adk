/**
 * Maps custom message URLs to specialized components.
 * "custom://guardrail" → GuardrailMessage (sent by onBeforeExecution when the topic check fails)
 */
import type { FC } from "react";
import type { BlockObjects } from "@botpress/webchat";
import GuardrailMessage from "./GuardrailMessage";
import type { GuardrailData } from "./GuardrailMessage";

const CustomTextRenderer: FC<BlockObjects["custom"]> = (props) => {
  const url = props.url || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (props as any).data as GuardrailData | undefined;

  if (url === "custom://guardrail" && data) {
    return <GuardrailMessage data={data as GuardrailData} />;
  }

  // Fallback
  return null;
};

export default CustomTextRenderer;
