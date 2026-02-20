import { type FC, useState, useEffect } from "react";
import type { ImportData } from "../types/import";
import { useImportData } from "../context/ImportDataContext";
import { useImportContext } from "../context/ImportContext";

type Props = {
  data: ImportData;
  isOpen: boolean;
  onClose: () => void;
};

const PHASES = ["Parse", "Validate", "Import", "Complete"] as const;

type PhaseStatus = "pending" | "active" | "done" | "error" | "warning";

function getPhaseStatuses(status: ImportData["status"]): PhaseStatus[] {
  switch (status) {
    case "parsing":
      return ["active", "pending", "pending", "pending"];
    case "validating":
      return ["done", "active", "pending", "pending"];
    case "importing":
      return ["done", "done", "active", "pending"];
    case "done":
      return ["done", "done", "done", "done"];
    case "errored":
      // Find the last active phase and mark it as error
      return ["done", "done", "error", "pending"];
    case "cancelled":
      return ["done", "warning", "pending", "pending"];
    default:
      return ["pending", "pending", "pending", "pending"];
  }
}

const ImportPanel: FC<Props> = ({ data: initialData, isOpen, onClose }) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const { importMessages } = useImportData();
  const { currentMessageId } = useImportContext();

  const data =
    (currentMessageId && importMessages.get(currentMessageId)) || initialData;

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShouldAnimate(true), 10);
      return () => {
        clearTimeout(timer);
        setShouldAnimate(false);
      };
    }
    return () => setShouldAnimate(false);
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const phaseStatuses = getPhaseStatuses(data.status);
  const errorCount = data.errors?.length ?? 0;
  const isTerminal = data.status === "done" || data.status === "errored" || data.status === "cancelled";

  const renderPhaseStepper = () => (
    <div className="import-panel-phase-stepper" style={{ display: "flex", flexDirection: "column", gap: "0px", padding: "0 0 4px 0" }}>
      {PHASES.map((phase, i) => {
        const status = phaseStatuses[i];
        const isLast = i === PHASES.length - 1;

        return (
          <div key={phase} style={{ display: "flex", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "20px", flexShrink: 0 }}>
              <div className={`import-panel-phase-dot import-panel-phase-dot--${status}`} />
              {!isLast && <div className="import-panel-phase-line" style={{ flex: 1, width: "2px", minHeight: "12px" }} />}
            </div>
            <div
              className={`import-panel-phase-label import-panel-phase-label--${status}`}
              style={{ fontSize: "13px", lineHeight: "20px", paddingBottom: isLast ? "0" : "8px" }}
            >
              {status === "done" && (
                <span style={{ marginRight: "6px" }}>&#10003;</span>
              )}
              {status === "error" && (
                <span style={{ marginRight: "6px" }}>&#10007;</span>
              )}
              {status === "warning" && (
                <span style={{ marginRight: "6px" }}>&#9888;</span>
              )}
              {phase}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderPanelContent = () => (
    <>
      <div className="import-panel-header" style={{ flexShrink: 0, padding: "16px", borderBottomWidth: "1px", borderBottomStyle: "solid" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
            <div className="import-panel-label" style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              {data.status === "done" ? "Import Complete" : data.status === "errored" ? "Import Failed" : data.status === "cancelled" ? "Import Cancelled" : "Importing"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 className="import-panel-title" style={{ fontSize: "14px", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
                {data.fileName}
              </h2>
              {data.schemaDisplayName && (
                <span className="schema-badge">{data.schemaDisplayName}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="import-panel-close-btn"
            style={{ padding: "6px", borderRadius: "6px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }} className="panel-scroll">
        {renderPhaseStepper()}

        <div style={{ margin: "16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span className="import-panel-progress-text" style={{ fontSize: "11px" }}>Progress</span>
            <span className="import-panel-progress-text" style={{ fontSize: "11px", fontWeight: 500 }}>{data.progress}%</span>
          </div>
          <div className="import-panel-progress-track" style={{ width: "100%", height: "4px", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              backgroundColor: data.status === "errored" ? "#ef4444" : data.status === "cancelled" ? "#f59e0b" : data.status === "done" ? "#10b981" : "#3b82f6",
              width: `${data.progress}%`,
              transition: "width 0.3s ease",
              borderRadius: "2px",
            }} />
          </div>
        </div>

        {data.totalRows != null && (
          <div className="import-panel-stats-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", borderRadius: "8px", overflow: "hidden", margin: "12px 0" }}>
            <div className="import-panel-stat-cell" style={{ padding: "10px 12px", textAlign: "center" }}>
              <div className="import-panel-stat-value" style={{ fontSize: "16px", fontWeight: 600 }}>{data.totalRows}</div>
              <div className="import-panel-stat-label" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "2px" }}>Total</div>
            </div>
            <div className="import-panel-stat-cell" style={{ padding: "10px 12px", textAlign: "center" }}>
              <div className="import-panel-stat-value" style={{ fontSize: "16px", fontWeight: 600, color: "#10b981" }}>{data.importedRows ?? 0}</div>
              <div className="import-panel-stat-label" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "2px" }}>Imported</div>
            </div>
            <div className="import-panel-stat-cell" style={{ padding: "10px 12px", textAlign: "center" }}>
              <div className="import-panel-stat-value" style={{ fontSize: "16px", fontWeight: 600, color: (data.skippedRows ?? 0) > 0 ? "#f59e0b" : undefined }}>{data.skippedRows ?? 0}</div>
              <div className="import-panel-stat-label" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "2px" }}>Skipped</div>
            </div>
          </div>
        )}

        {data.pendingQuestion && !isTerminal && (
          <div className="import-panel-waiting-alert" style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px", borderRadius: "8px", margin: "12px 0" }}>
            <span style={{ fontSize: "16px", lineHeight: 1, flexShrink: 0 }}>&#9888;</span>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>Needs your input</div>
              <div style={{ fontSize: "12px", marginTop: "2px", opacity: 0.8 }}>{data.pendingQuestion}</div>
            </div>
          </div>
        )}

        {data.summary && isTerminal && (
          <div className="import-panel-current-phase" style={{ fontSize: "13px", padding: "8px 0", lineHeight: 1.5 }}>
            {data.summary}
          </div>
        )}

        {data.currentPhase && !isTerminal && (
          <div className="import-panel-current-phase" style={{ fontSize: "13px", padding: "8px 0", lineHeight: 1.5 }}>
            {data.currentPhase}
          </div>
        )}

        {errorCount > 0 && (
          <div className="import-panel-errors-section" style={{ marginTop: "16px" }}>
            <div className="import-panel-errors-title" style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
              {errorCount} {errorCount === 1 ? "Error" : "Errors"}
            </div>
            <div className="import-panel-errors-list" style={{ borderRadius: "8px", overflow: "hidden", maxHeight: "200px", overflowY: "auto" }}>
              {data.errors?.map((error, index) => (
                <div
                  key={index}
                  className="import-panel-error-item"
                  style={{ padding: "8px 12px", fontSize: "12px", lineHeight: 1.4 }}
                >
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.status === "cancelled" && (
          <div className="import-panel-waiting-alert" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", borderRadius: "8px", margin: "12px 0" }}>
            <span style={{ fontSize: "16px", lineHeight: 1 }}>&#9888;</span>
            <div style={{ fontSize: "13px", fontWeight: 500 }}>Import was cancelled</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .panel-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .panel-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .panel-scroll::-webkit-scrollbar-thumb {
          background: #3F434F;
          border-radius: 2px;
        }
        .panel-scroll::-webkit-scrollbar-thumb:hover {
          background: #5F6476;
        }
      `}</style>
    </>
  );

  return (
    <div
      className="import-panel"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "340px",
        borderLeftWidth: "1px",
        borderLeftStyle: "solid",
        display: "flex",
        flexDirection: "column",
        transform: shouldAnimate ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 40,
        boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.15)",
      }}
    >
      {renderPanelContent()}
    </div>
  );
};

export default ImportPanel;
