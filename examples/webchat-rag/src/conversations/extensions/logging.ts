import { Autonomous } from "@botpress/runtime";

export const onTraceLogging: Autonomous.Hooks["onTrace"] = ({ trace }) => {
  if (trace.type === "code_execution_exception") {
    console.error(`Code Execution Error: ${trace.message}`, trace.stackTrace);
  }

  if (trace.type === "tool_call" && !trace.success) {
    console.error(
      `Error during tool call to "${trace.tool_name}" with input "${JSON.stringify(trace.input)}":`,
      trace.error
    );
  }
};
