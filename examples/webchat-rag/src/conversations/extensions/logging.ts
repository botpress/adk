import { Autonomous } from "@botpress/runtime";

/**
 * An onTrace hook that logs errors from the autonomous agent loop.
 * Only logs failures — code execution exceptions and failed tool calls.
 * These logs appear in the Botpress dashboard developer console.
 */
export const onTraceLogging: Autonomous.Hooks["onTrace"] = ({ trace }) => {
  if (trace.type === "code_execution_exception") {
    console.error(`Code Execution Error: ${trace.message}`, trace.stackTrace);
  }

  // Tool call traces include both successes and failures —
  // only log failures to keep noise down
  if (trace.type === "tool_call" && !trace.success) {
    console.error(
      `Error during tool call to "${trace.tool_name}" with input "${JSON.stringify(trace.input)}":`,
      trace.error
    );
  }
};
