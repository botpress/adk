import type { CheckResult } from "@/types";

export type ParsedMessage =
  | {
      type: "workflow_request";
      id: string;
      checks: string[];
    }
  | {
      type: "workflow_success";
      id: string;
      title: string;
      results: CheckResult[];
    }
  | {
      type: "workflow_failure";
      id: string;
    }
  | null;

export function parseBackendMessage(text: string): ParsedMessage {
  const lines = text.split("\n");

  if (lines[0] === "Workflow Request") {
    try {
      const json = JSON.parse(lines.slice(1).join("\n"));
      return {
        type: "workflow_request",
        id: json.id,
        checks: json.checks,
      };
    } catch {
      return null;
    }
  }

  if (lines[0] === "Workflow Completion" && lines[1] === "Success") {
    try {
      const json = JSON.parse(lines.slice(2).join("\n"));
      return {
        type: "workflow_success",
        id: json.id,
        title: json.title,
        results: json.results,
      };
    } catch {
      return null;
    }
  }

  if (lines[0] === "Workflow Failure") {
    try {
      const json = JSON.parse(lines.slice(1).join("\n"));
      return {
        type: "workflow_failure",
        id: json.id,
      };
    } catch {
      return null;
    }
  }

  return null;
}
