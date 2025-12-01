import { useState, type FC } from "react";

type StepData = {
  type: "start" | "thinking" | "tool" | "end";
  executionId: string;
  agent: string;
  task: string;
  stepCount?: number;
  ts: number;
};

type SubAgentStep = {
  name: string;
  data: StepData;
};

type Props = {
  steps: SubAgentStep[];
};

const SubAgentCard: FC<Props> = ({ steps }) => {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  const startStep = steps.find((s) => s.data.type === "start");
  const endStep = steps.find((s) => s.data.type === "end");
  const middleSteps = steps.filter((s) => s.data.type === "thinking" || s.data.type === "tool");

  const isRunning = !endStep;
  const agent = startStep?.data.agent?.toUpperCase() || "AGENT";
  const task = startStep?.data.task || "";
  const taskPreview = task.length > 40 ? task.slice(0, 40) + "..." : task;
  const stepCount = endStep?.data.stepCount ?? middleSteps.length;

  // Get the last step for "running" display
  const lastStep = middleSteps[middleSteps.length - 1];

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: "13px",
        padding: "8px 12px",
        background: "#1a1a1a",
        borderRadius: "8px",
        marginLeft: "16px",
        border: "1px solid #333",
        color: "#e0e0e0",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: !isRunning ? "pointer" : "default",
        }}
        onClick={() => !isRunning && setExpanded(!expanded)}
      >
        <span>
          {isRunning ? "⏳" : endStep?.name.startsWith("✅") ? "✅" : endStep?.name.startsWith("⚠️") ? "⚠️" : "❌"}{" "}
          {agent} → "{taskPreview}"
        </span>
        {!isRunning && (
          <span style={{ color: "#888", fontSize: "12px" }}>
            ({stepCount} steps) {expanded ? "▼" : "▶"}
          </span>
        )}
      </div>

      {/* Running: show last step */}
      {isRunning && lastStep && (
        <div style={{ marginTop: "4px", paddingLeft: "16px", color: "#999" }}>└─ {lastStep.name}</div>
      )}

      {/* Completed & Expanded: show all steps */}
      {!isRunning && expanded && middleSteps.length > 0 && (
        <div style={{ marginTop: "8px", paddingLeft: "8px", borderLeft: "2px solid #444" }}>
          {middleSteps.map((step, i) => (
            <div
              key={i}
              style={{
                padding: "2px 0 2px 8px",
                color: "#999",
                fontSize: "12px",
              }}
            >
              {i === middleSteps.length - 1 ? "└─" : "├─"} {step.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubAgentCard;
