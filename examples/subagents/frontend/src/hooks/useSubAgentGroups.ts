import { useMemo } from "react";
import type { BlockMessage } from "@botpress/webchat";

type StepData = {
  type: "start" | "thinking" | "tool" | "end";
  executionId: string;
  agent: string;
  task: string;
  stepCount?: number;
  ts: number;
};

export type SubAgentStep = {
  name: string;
  data: StepData;
};

export type SubAgentGroup = {
  executionId: string;
  steps: SubAgentStep[];
};

/**
 * Groups subagent step messages by executionId into a Map.
 *
 * Each subagent invocation sends multiple custom messages (start, thinking,
 * tool, end) that share the same executionId. This hook collects them so
 * SubAgentCard can render one card per invocation with all its steps inside.
 * Steps within each group are sorted by timestamp to ensure correct order
 * even if messages arrive out of sequence.
 */
export function useSubAgentGroups(messages: BlockMessage[]) {
  return useMemo(() => {
    const groups = new Map<string, SubAgentStep[]>();

    for (const msg of messages) {
      const block = msg.block as any;
      if (block?.url !== "subagent") continue;

      const data = block.data as StepData | undefined;
      if (!data?.executionId) continue;

      const step: SubAgentStep = {
        name: block.name || "",
        data,
      };

      const existing = groups.get(data.executionId) || [];
      existing.push(step);
      groups.set(data.executionId, existing);
    }

    // Sort steps within each group by timestamp
    for (const [, steps] of groups) {
      steps.sort((a, b) => a.data.ts - b.data.ts);
    }

    return groups;
  }, [messages]);
}
