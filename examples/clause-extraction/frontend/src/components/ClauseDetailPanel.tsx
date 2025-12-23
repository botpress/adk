import { type FC, useState, useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { FileText, AlertCircle, CheckCircle, XCircle, Clock, X } from "lucide-react";
import type { ExtractionData, Activity, Clause, RiskLevel, PassageStats, CurrentBatch } from "../types/extraction";
import { useExtractionData } from "../context/ExtractionDataContext";
import { useExtraction } from "../context/ExtractionContext";
import { CLAUSE_TYPE_LABELS, RISK_COLORS } from "../config/constants";
import clsx from "clsx";

type Props = {
  data: ExtractionData;
  isOpen: boolean;
  onClose: () => void;
};

const ClauseDetailPanel: FC<Props> = ({ data: initialData, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"activity" | "clauses">("activity");
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<RiskLevel | "all">("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const { extractionMessages } = useExtractionData();
  const { currentMessageId, openModal } = useExtraction();

  const data =
    (currentMessageId && extractionMessages.get(currentMessageId)) || initialData;

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

  const getActivityIcon = (type: string, status: string) => {
    if (status === "error") {
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    }

    switch (type) {
      case "reading":
        return <FileText className="w-3.5 h-3.5 text-gray-500" />;
      case "extracting":
        return <AlertCircle className="w-3.5 h-3.5 text-blue-500" />;
      case "reviewing":
        return <CheckCircle className="w-3.5 h-3.5 text-purple-500" />;
      case "storing":
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      case "summarizing":
        return <FileText className="w-3.5 h-3.5 text-emerald-500" />;
      case "complete":
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getDotColor = (status: string) => {
    switch (status) {
      case "error":
        return "#ef4444";
      case "in_progress":
        return "#3b82f6";
      case "done":
        return "#10b981";
      default:
        return "#d1d5db";
    }
  };

  const formatPassageStats = (stats: PassageStats): string => {
    const parts: string[] = [];
    const contentCount = stats.total - stats.skipped;
    if (contentCount > 0) parts.push(`${stats.processed}/${contentCount} passages`);
    if (stats.withClauses > 0) parts.push(`${stats.withClauses} clauses found`);
    return parts.join(" · ");
  };

  const formatPageRange = (pageRange: { start: number; end: number }): string => {
    return pageRange.start === pageRange.end
      ? `Page ${pageRange.start}`
      : `Pages ${pageRange.start}-${pageRange.end}`;
  };

  const renderActivityItem = (
    activity: Activity,
    index: number,
    isLast: boolean,
    isFirst: boolean
  ) => {
    const dotColor = getDotColor(activity.status);

    return (
      <div key={activity.id || index} className="flex gap-3 relative">
        <div className="flex flex-col items-center w-5 flex-shrink-0">
          <div
            className={clsx(
              "w-2.5 h-2.5 rounded-full z-10",
              activity.status === "in_progress" && "animate-pulse"
            )}
            style={{
              backgroundColor: dotColor,
              boxShadow: `0 0 0 2px ${dotColor}30`,
            }}
          />
          {!isLast && (
            <div className="flex-1 w-0.5 research-panel-timeline-line mt-1" />
          )}
        </div>

        <div className={clsx("flex-1 min-w-0", !isLast && "pb-4")}>
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-4.5 h-4.5 flex items-center justify-center">
              {getActivityIcon(activity.type, activity.status)}
            </div>
            <div
              className={clsx(
                "flex-1 min-w-0 text-[13px] leading-snug",
                isFirst ? "font-medium research-panel-activity-current" : "research-panel-activity-text",
                activity.status === "error" && "text-red-500"
              )}
            >
              {activity.text}
            </div>
          </div>
          {activity.clauseType && (
            <div className="mt-1 ml-6 text-[11px] research-panel-activity-text-muted">
              Type: {CLAUSE_TYPE_LABELS[activity.clauseType] || activity.clauseType}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Filter activities to show only recent extracting activities during extraction
  const getDisplayActivities = (activities: Activity[]) => {
    if (data.status !== "in_progress") {
      return activities;
    }

    // Keep all non-extracting activities + last 5 extracting activities
    const nonExtracting = activities.filter(a => a.type !== "extracting");
    const extracting = activities.filter(a => a.type === "extracting");
    const recentExtracting = extracting.slice(-5);

    // Combine and sort by id (assuming ids are sequential/chronological)
    return [...nonExtracting, ...recentExtracting].sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  };

  const displayActivities = getDisplayActivities(data.activities);

  const clauses = data.clauses || [];
  const filteredClauses = clauses.filter((clause) => {
    if (selectedRiskFilter !== "all" && clause.riskLevel !== selectedRiskFilter) {
      return false;
    }
    if (selectedTypeFilter !== "all" && clause.clauseType !== selectedTypeFilter) {
      return false;
    }
    return true;
  });

  const uniqueTypes = [...new Set(clauses.map((c) => c.clauseType))];

  return (
    <div
      className={clsx(
        "research-panel fixed top-0 right-0 bottom-0 w-[420px]",
        "flex flex-col shadow-xl z-40 transition-transform duration-300 ease-out border-l",
        shouldAnimate ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="research-panel-header flex-shrink-0 p-4 border-b">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider research-panel-label mb-1">
              Contract Analysis
            </div>
            <h2 className="text-[14px] font-semibold research-panel-title leading-tight line-clamp-2">
              {data.topic || "Unknown Document"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 research-panel-label hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] research-panel-progress-text">Progress</span>
            <span className="text-[11px] font-medium research-panel-title">{data.progress}%</span>
          </div>
          <div className="w-full h-1 research-panel-progress-track rounded-full overflow-hidden">
            <div
              className={clsx(
                "h-full transition-all duration-300 rounded-full",
                data.status === "error" ? "bg-red-500" :
                data.status === "cancelled" ? "bg-amber-500" :
                data.status === "done" ? "bg-green-500" :
                "bg-blue-500"
              )}
              style={{ width: `${data.progress}%` }}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as "activity" | "clauses")}>
          <Tabs.List className="flex gap-1 research-panel-tabs rounded-lg p-0.5">
            <Tabs.Trigger
              value="activity"
              className={clsx(
                "flex-1 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all",
                activeTab === "activity"
                  ? "research-panel-tab-active shadow-sm"
                  : "research-panel-tab"
              )}
            >
              Activity
            </Tabs.Trigger>
            <Tabs.Trigger
              value="clauses"
              className={clsx(
                "flex-1 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all",
                activeTab === "clauses"
                  ? "research-panel-tab-active shadow-sm"
                  : "research-panel-tab"
              )}
            >
              {data.clausesFound} Clauses
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 research-panel-scroll">
        {activeTab === "activity" && (
          <div>
            {/* Contract Summary - shown after summarization completes */}
            {data.summary && (
              <div className="mb-4 p-3 rounded-lg border extraction-summary-box">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2 extraction-summary-label">
                  Contract Summary
                </h4>
                <p className="text-[13px] leading-relaxed research-panel-activity-text">
                  {data.summary}
                </p>
              </div>
            )}

            {/* Summarizing indicator */}
            {data.status === "summarizing" && !data.summary && (
              <div className="mb-4 p-3 rounded-lg border extraction-progress-box">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-[12px] research-panel-activity-text">
                    Generating contract summary...
                  </span>
                </div>
              </div>
            )}

            {/* Current Progress Summary - compact one-line format */}
            {data.status === "in_progress" && (data.currentBatch || data.passageStats) && (
              <div className="mb-3 px-3 py-2 rounded-lg extraction-progress-box text-[11px]">
                <div className="flex items-center gap-2 flex-wrap research-panel-activity-text">
                  {data.currentBatch && (
                    <>
                      <span className="font-medium">
                        Batch {data.currentBatch.index}/{data.currentBatch.total}
                      </span>
                      {data.currentBatch.sectionHeader && (
                        <>
                          <span className="opacity-40">•</span>
                          <span className="truncate max-w-[180px]">{data.currentBatch.sectionHeader}</span>
                        </>
                      )}
                      {!data.currentBatch.sectionHeader && data.currentBatch.pageRange && (
                        <>
                          <span className="opacity-40">•</span>
                          <span>{formatPageRange(data.currentBatch.pageRange)}</span>
                        </>
                      )}
                    </>
                  )}
                  {data.passageStats && data.passageStats.withClauses > 0 && (
                    <>
                      <span className="opacity-40">•</span>
                      <span className="text-green-600 dark:text-green-400">
                        {data.passageStats.withClauses} clauses found
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {[...displayActivities]
              .reverse()
              .map((activity, index, arr) =>
                renderActivityItem(
                  activity,
                  index,
                  index === arr.length - 1,
                  index === 0
                )
              )}

            {data.status === "in_progress" && data.activities.length === 0 && (
              <div className="flex gap-2.5 py-2.5 items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[13px] research-panel-activity-text-muted">Starting extraction...</span>
              </div>
            )}

            {data.error && data.status === "error" && (
              <div className="mt-3 p-3 extraction-error-box rounded-lg">
                <div className="text-[12px] extraction-error-text">
                  <strong>Failed:</strong> {data.error}
                </div>
              </div>
            )}

            {data.status === "cancelled" && (
              <div className="mt-3 p-3 extraction-warning-box rounded-lg">
                <div className="text-[12px] extraction-warning-text">
                  <strong>Cancelled:</strong> {data.error || "Extraction was cancelled."}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "clauses" && (
          <div>
            {/* Filters */}
            <div className="mb-4 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedRiskFilter("all")}
                  className={clsx(
                    "px-2 py-1 text-[11px] font-medium rounded-md transition-colors",
                    selectedRiskFilter === "all"
                      ? "extraction-filter-active"
                      : "extraction-filter"
                  )}
                >
                  All Risks
                </button>
                {(["high", "medium", "low"] as RiskLevel[]).map((risk) => (
                  <button
                    key={risk}
                    onClick={() => setSelectedRiskFilter(risk)}
                    className={clsx(
                      "px-2 py-1 text-[11px] font-medium rounded-md transition-colors capitalize",
                      selectedRiskFilter === risk
                        ? RISK_COLORS[risk].badge
                        : "extraction-filter"
                    )}
                  >
                    {risk}
                  </button>
                ))}
              </div>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="extraction-select w-full px-2 py-1.5 text-[12px] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types ({clauses.length})</option>
                {uniqueTypes.map((type) => (
                  <option key={type} value={type}>
                    {CLAUSE_TYPE_LABELS[type] || type} (
                    {clauses.filter((c) => c.clauseType === type).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Clause List */}
            <div className="space-y-2">
              {filteredClauses.length > 0 ? (
                filteredClauses.map((clause) => (
                  <button
                    key={clause.id}
                    onClick={() => openModal(clause)}
                    className="extraction-clause-card w-full text-left p-3 rounded-lg transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="text-[13px] font-medium extraction-clause-title leading-tight">
                        {clause.title}
                      </div>
                      <span
                        className={clsx(
                          "px-1.5 py-0.5 text-[10px] font-medium rounded capitalize flex-shrink-0",
                          RISK_COLORS[clause.riskLevel].badge
                        )}
                      >
                        {clause.riskLevel}
                      </span>
                    </div>
                    {clause.section && (
                      <div className="text-[11px] extraction-clause-section mb-1.5">{clause.section}</div>
                    )}
                    <ul className="space-y-0.5">
                      {clause.keyPoints.slice(0, 2).map((point, idx) => (
                        <li key={idx} className="text-[11px] extraction-clause-text flex items-start gap-1.5">
                          <span className="extraction-clause-bullet mt-0.5">•</span>
                          <span className="line-clamp-1">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-[13px] research-panel-activity-text-muted">
                  No clauses match the selected filters
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default ClauseDetailPanel;
