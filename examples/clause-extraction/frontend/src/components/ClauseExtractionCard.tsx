import { type FC } from "react";
import type { ExtractionData } from "../types/extraction";
import { CLAUSE_TYPE_LABELS } from "../config/constants";
import clsx from "clsx";

type Props = {
  data: ExtractionData;
  onExpand: () => void;
};

const ClauseExtractionCard: FC<Props> = ({ data, onExpand }) => {
  const documentName = data?.topic || "Unknown Document";
  const progress = data?.progress ?? 0;
  const status = data?.status || "in_progress";
  const clausesFound = data?.clausesFound ?? 0;
  const clausesByType = data?.clausesByType || {};
  const passageStats = data?.passageStats;
  const currentBatch = data?.currentBatch;

  const getStatusText = () => {
    switch (status) {
      case "in_progress":
        if (currentBatch) {
          return `Batch ${currentBatch.index}/${currentBatch.total}`;
        }
        return "Extracting clauses";
      case "done":
        return "Complete";
      case "error":
        return "Failed";
      case "cancelled":
        return "Cancelled";
      default:
        return "Starting extraction";
    }
  };

  const getPassageStatsText = () => {
    if (!passageStats) return null;
    const parts: string[] = [];
    const contentCount = passageStats.total - passageStats.skipped;
    if (contentCount > 0) parts.push(`${contentCount} content`);
    if (passageStats.skipped > 0) parts.push(`${passageStats.skipped} skipped`);
    if (passageStats.withClauses > 0) parts.push(`${passageStats.withClauses} found`);
    return parts.join(" · ");
  };

  const getTopClauseTypes = () => {
    const entries = Object.entries(clausesByType).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 3);
  };

  const topTypes = getTopClauseTypes();

  return (
    <div
      onClick={onExpand}
      className={clsx(
        "research-card rounded-2xl cursor-pointer transition-all duration-150 max-w-[600px]",
        status === "done" && "research-card-done"
      )}
      style={{ padding: "14px 16px" }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider research-card-topic mb-1">
            Contract Analysis
          </div>
          <div className="text-[15px] font-semibold leading-tight mb-1 research-card-title">
            {documentName}
          </div>
          <div className="text-[13px] research-card-summary">
            {clausesFound} {clausesFound === 1 ? "clause" : "clauses"} found
          </div>
        </div>
        <div className="flex-shrink-0 pt-0.5">
          {status === "in_progress" && (
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
          {status === "done" && (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#10b981" />
              <path
                d="M14 7L8.5 12.5L6 10"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {status === "error" && (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#ef4444" />
              <path
                d="M7 7L13 13M13 7L7 13"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
          {status === "cancelled" && (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#f59e0b" />
              <rect x="6" y="9" width="8" height="2" rx="1" fill="white" />
            </svg>
          )}
        </div>
      </div>

      {/* Current Batch Info - show section and page range when extracting */}
      {status === "in_progress" && currentBatch && (
        <div className="mb-2.5 text-[12px] research-card-summary space-y-0.5">
          {currentBatch.sectionHeader && (
            <div className="truncate">
              <span className="opacity-60">Section:</span> {currentBatch.sectionHeader}
            </div>
          )}
          {currentBatch.pageRange && (
            <div>
              <span className="opacity-60">Pages:</span> {currentBatch.pageRange.start === currentBatch.pageRange.end
                ? currentBatch.pageRange.start
                : `${currentBatch.pageRange.start}-${currentBatch.pageRange.end}`}
            </div>
          )}
        </div>
      )}

      {/* Passage Stats - show during extraction */}
      {status === "in_progress" && passageStats && (
        <div className="mb-2.5 text-[11px] research-card-summary opacity-70">
          {getPassageStatsText()}
        </div>
      )}

      {/* Clause Type Badges */}
      {topTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {topTypes.map(([type, count]) => (
            <span
              key={type}
              className="extraction-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            >
              {CLAUSE_TYPE_LABELS[type] || type}
              <span className="extraction-badge-count">×{count}</span>
            </span>
          ))}
          {Object.keys(clausesByType).length > 3 && (
            <span className="extraction-badge-more inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium">
              +{Object.keys(clausesByType).length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Progress Bar - hide when done */}
      {status !== "done" && (
        <div className="mb-2">
          <div className="w-full h-1 research-card-progress-track rounded-full overflow-hidden">
            <div
              className={clsx(
                "h-full transition-all duration-300 rounded-full",
                status === "error" ? "bg-red-500" :
                status === "cancelled" ? "bg-amber-500" :
                "bg-gradient-to-r from-blue-500 to-blue-600"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span
          className={clsx(
            "text-[13px]",
            status === "done" ? "font-medium research-card-status-done" : "research-card-status"
          )}
        >
          {getStatusText()}
        </span>
        <span
          className={clsx(
            "text-[13px] font-medium transition-opacity duration-150",
            status === "done" ? "research-card-status-done opacity-100" : "text-blue-400 opacity-0 group-hover:opacity-100"
          )}
        >
          {status === "done" ? "View Details →" : "View Progress →"}
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        div:hover .opacity-0 {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default ClauseExtractionCard;
