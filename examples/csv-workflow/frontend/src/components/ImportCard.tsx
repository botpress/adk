import { type FC } from "react";
import type { ImportData } from "../types/import";

type Props = {
  data: ImportData;
  onExpand: () => void;
};

const ImportCard: FC<Props> = ({ data, onExpand }) => {
  const { fileName, progress, status, totalRows, importedRows, skippedRows } = data;

  const isTerminal = status === "done" || status === "errored" || status === "cancelled";

  const getStatusText = () => {
    switch (status) {
      case "pending":
        return "Preparing...";
      case "parsing":
        return "Parsing CSV...";
      case "validating":
        return "Validating rows...";
      case "importing":
        return `Importing${totalRows ? ` (${importedRows ?? 0}/${totalRows})` : "..."}`;
      case "done":
        return `Imported ${importedRows ?? 0}${totalRows ? `/${totalRows}` : ""} rows`;
      case "errored":
        return "Import failed";
      case "cancelled":
        return "Import cancelled";
      default:
        return "Starting import...";
    }
  };

  const getProgressColor = () => {
    if (status === "errored") return "#ef4444";
    if (status === "cancelled") return "#f59e0b";
    if (status === "done") return "#10b981";
    return "#3b82f6";
  };

  return (
    <div
      onClick={onExpand}
      className={`import-card ${status === "done" ? "import-card-done" : ""}`}
      style={{
        padding: "14px 16px",
        borderRadius: "12px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        maxWidth: "720px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
        <div style={{
          flexShrink: 0,
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          backgroundColor: status === "done" ? "#dcfce7" : "#eff6ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={status === "done" ? "#16a34a" : "#3b82f6"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <div className="import-card-title" style={{
              fontWeight: 600,
              fontSize: "14px",
              lineHeight: "1.3",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {fileName}
            </div>
            {data.schemaDisplayName && (
              <span className="schema-badge">{data.schemaDisplayName}</span>
            )}
          </div>
          <div className="import-card-status-text" style={{
            fontSize: "13px",
            lineHeight: "1.4",
          }}>
            {getStatusText()}
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          {!isTerminal && (
            <div style={{
              width: "8px",
              height: "8px",
              backgroundColor: "#3b82f6",
              borderRadius: "50%",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }} />
          )}
          {status === "done" && (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#10b981"/>
              <path d="M14 7L8.5 12.5L6 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {status === "errored" && (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#ef4444"/>
              <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
          {status === "cancelled" && (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#f59e0b"/>
              <rect x="6" y="9" width="8" height="2" rx="1" fill="white"/>
            </svg>
          )}
        </div>
      </div>

      {totalRows != null && (
        <div style={{
          display: "flex",
          gap: "14px",
          fontSize: "12px",
          marginBottom: "8px",
        }}>
          <span className="import-card-stat">
            <strong>{totalRows}</strong> total
          </span>
          {importedRows != null && (
            <span className="import-card-stat" style={{ color: "#10b981" }}>
              <strong>{importedRows}</strong> imported
            </span>
          )}
          {skippedRows != null && skippedRows > 0 && (
            <span className="import-card-stat" style={{ color: "#f59e0b" }}>
              <strong>{skippedRows}</strong> skipped
            </span>
          )}
        </div>
      )}

      {!isTerminal && (
        <div style={{ marginBottom: "8px" }}>
          <div className="import-card-progress-track" style={{
            width: "100%",
            height: "4px",
            borderRadius: "2px",
            overflow: "hidden",
          }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                backgroundColor: getProgressColor(),
                transition: "width 0.3s ease",
                borderRadius: "2px",
              }}
            />
          </div>
        </div>
      )}

      {data.pendingQuestion && !isTerminal && (
        <div style={{
          marginTop: "6px",
          padding: "6px 10px",
          backgroundColor: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "6px",
          fontSize: "11px",
          color: "#92400e",
        }}>
          Needs your input to continue
        </div>
      )}

      {!isTerminal && data.currentPhase && (
        <div style={{
          fontSize: "12px",
          color: "#6b7280",
          marginTop: "2px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {data.currentPhase}
        </div>
      )}

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: "4px",
      }}>
        <span style={{
          fontSize: "13px",
          color: status === "done" ? "#059669" : "#3b82f6",
          fontWeight: 500,
          opacity: isTerminal ? 1 : 0,
          transition: "opacity 0.15s ease",
        }} className="view-details-text">
          {status === "done" ? "View Summary" : status === "errored" ? "View Errors" : "View Details"} &rarr;
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        div:hover .view-details-text {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default ImportCard;
