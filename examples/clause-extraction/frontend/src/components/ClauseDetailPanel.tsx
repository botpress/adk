import { type FC, useState, useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { FileText, AlertCircle, CheckCircle, XCircle, Clock, X, ChevronDown, ChevronUp, Copy, Check, ArrowLeft, BookOpen } from "lucide-react";
import type { ExtractionData, Activity, Clause, RiskLevel } from "../types/extraction";
import { useExtractionMessage } from "../context/ExtractionDataContext";
import { useExtraction } from "../context/ExtractionContext";
import { CLAUSE_TYPE_LABELS, RISK_COLORS } from "../config/constants";
import clsx from "clsx";

// Hook to detect mobile viewport
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
};

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
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isSourceExpanded, setIsSourceExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { currentMessageId, selectedClause, selectClause, clearSelection, isPanelExpanded } = useExtraction();
  const isMobile = useIsMobile();

  // Use selective subscription - only re-renders when this specific message's data changes
  const cachedData = useExtractionMessage(currentMessageId);
  const data = cachedData || initialData;

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

  // Auto-switch to Clauses tab when extraction completes
  useEffect(() => {
    if (isOpen && data.status === "done") {
      setActiveTab("clauses");
    }
  }, [isOpen, data.status]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (selectedClause) {
          clearSelection();
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, selectedClause, clearSelection]);

  // Reset source expansion when clause selection changes
  useEffect(() => {
    setIsSourceExpanded(false);
  }, [selectedClause?.id]);

  const handleCopy = async () => {
    if (!selectedClause) return;
    await navigator.clipboard.writeText(selectedClause.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  // Handle clause click - toggle selection
  const handleClauseClick = (clause: Clause) => {
    if (selectedClause?.id === clause.id) {
      clearSelection();
    } else {
      selectClause(clause);
    }
  };

  return (
    <div
      className={clsx(
        "research-panel fixed top-0 right-0 bottom-0",
        "flex flex-col shadow-xl z-40 border-l",
        "transition-all duration-300 ease-out",
        isPanelExpanded
          ? "w-[700px] lg:w-[750px] xl:w-[800px] max-w-[70vw]"
          : "w-[420px] lg:w-[33vw] xl:w-[480px] 2xl:w-[40vw] min-w-[380px] max-w-[50vw]",
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
          <Tabs.List className="flex gap-0.5 research-panel-tabs rounded-md p-0.5">
            <Tabs.Trigger
              value="activity"
              className={clsx(
                "flex-1 px-2 py-1 text-[11px] font-medium rounded transition-all",
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
                "flex-1 px-2 py-1 text-[11px] font-medium rounded transition-all",
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
      <div className="flex-1 overflow-hidden">
        {activeTab === "activity" && (
          <div className="h-full overflow-y-auto p-4 research-panel-scroll">
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
          <div className={clsx(
            "h-full",
            // On desktop: side-by-side when expanded; on mobile: stacked (show one at a time)
            !isMobile && isPanelExpanded ? "flex" : "flex flex-col"
          )}>
            {/* Left column: Summary, Filters, List - hidden on mobile when clause selected */}
            <div className={clsx(
              "flex flex-col overflow-hidden",
              !isMobile && isPanelExpanded ? "w-[280px] border-r research-panel-header" : "flex-1",
              isMobile && selectedClause && "hidden"
            )}>
              <div className="flex-1 overflow-y-auto px-3 py-3 research-panel-scroll">
                {/* Collapsible Contract Summary - green box style */}
                {data.summary && (
                  <button
                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    className="w-full text-left mb-3 p-3 rounded-lg extraction-summary-box"
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider extraction-summary-label">
                        Summary
                      </span>
                      <ChevronDown className={clsx(
                        "w-3 h-3 extraction-summary-label transition-transform",
                        isSummaryExpanded && "rotate-180"
                      )} />
                    </div>
                    <p className={clsx(
                      "text-[12px] leading-relaxed research-panel-activity-text",
                      !isSummaryExpanded && "line-clamp-2"
                    )}>
                      {data.summary}
                    </p>
                  </button>
                )}

                {/* Summarizing indicator */}
                {data.status === "summarizing" && !data.summary && (
                  <div className="mb-3 p-3 rounded-lg extraction-progress-box flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[11px] research-panel-activity-text-muted">
                      Generating summary...
                    </span>
                  </div>
                )}

                {/* Filters - smaller, tighter */}
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  {(["all", "high", "medium", "low"] as const).map((risk) => (
                    <button
                      key={risk}
                      onClick={() => setSelectedRiskFilter(risk)}
                      className={clsx(
                        "h-6 px-2 text-[10px] rounded transition-colors",
                        selectedRiskFilter === risk
                          ? "extraction-filter-active"
                          : "extraction-filter-ghost"
                      )}
                    >
                      {risk === "all" ? "All" : (
                        <span className="flex items-center gap-1">
                          <span className={clsx(
                            "w-1.5 h-1.5 rounded-full",
                            risk === "high" && "bg-red-500",
                            risk === "medium" && "bg-amber-500",
                            risk === "low" && "bg-green-500"
                          )} />
                          <span className="capitalize">{risk}</span>
                        </span>
                      )}
                    </button>
                  ))}
                  <select
                    value={selectedTypeFilter}
                    onChange={(e) => setSelectedTypeFilter(e.target.value)}
                    className="extraction-select-minimal h-6 px-1.5 text-[10px] rounded focus:outline-none"
                  >
                    <option value="all">All types</option>
                    {uniqueTypes.map((type) => (
                      <option key={type} value={type}>
                        {CLAUSE_TYPE_LABELS[type] || type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clause List - borderless, tight rows */}
                <div className="space-y-px">
                  {filteredClauses.length > 0 ? (
                    filteredClauses.map((clause) => (
                      <button
                        key={clause.id}
                        onClick={() => handleClauseClick(clause)}
                        className={clsx(
                          "w-full text-left px-2 py-2 rounded transition-colors",
                          selectedClause?.id === clause.id
                            ? "extraction-row-selected"
                            : "extraction-row"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {/* Risk indicator dot */}
                          <span className={clsx(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            clause.riskLevel === "high" && "bg-red-500",
                            clause.riskLevel === "medium" && "bg-amber-500",
                            clause.riskLevel === "low" && "bg-green-500"
                          )} />
                          <span className={clsx(
                            "text-[13px] truncate",
                            selectedClause?.id === clause.id
                              ? "font-medium extraction-row-title-selected"
                              : "extraction-row-title"
                          )}>
                            {clause.title}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-8 text-center text-[12px] research-panel-activity-text-muted">
                      No clauses match filters
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column: Detail pane (desktop: when expanded; mobile: when selected) */}
            {(isPanelExpanded || (isMobile && selectedClause)) && selectedClause && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Detail Header */}
                <div className="flex-shrink-0 px-5 py-4 border-b research-panel-header">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Mobile back button */}
                      {isMobile && (
                        <button
                          onClick={clearSelection}
                          className="flex items-center gap-1.5 text-[12px] font-medium research-panel-label hover:text-gray-700 dark:hover:text-gray-300 mb-3 -ml-1"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back to list
                        </button>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={clsx(
                            "px-2 py-0.5 text-[10px] font-semibold rounded capitalize",
                            RISK_COLORS[selectedClause.riskLevel].badge
                          )}
                        >
                          {selectedClause.riskLevel} Risk
                        </span>
                        <span className="clause-modal-type-badge px-2 py-0.5 text-[10px] font-medium rounded">
                          {CLAUSE_TYPE_LABELS[selectedClause.clauseType] || selectedClause.clauseType}
                        </span>
                      </div>
                      <h3 className="text-[15px] font-semibold research-panel-title leading-tight">
                        {selectedClause.title}
                      </h3>
                      {selectedClause.section && (
                        <p className="text-[12px] research-panel-activity-text-muted mt-1">
                          {selectedClause.section}
                        </p>
                      )}
                    </div>
                    {/* Desktop close button */}
                    {!isMobile && (
                      <button
                        onClick={clearSelection}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 research-panel-label hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Detail Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 research-panel-scroll">
                  {/* Full Text */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider research-panel-label">
                        Full Clause Text
                      </h4>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium extraction-filter rounded transition-colors hover:opacity-80"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="clause-modal-collapsible-border border rounded-lg p-4">
                      <p className="text-[13px] leading-relaxed research-panel-activity-text whitespace-pre-wrap">
                        {selectedClause.text}
                      </p>
                    </div>
                  </div>

                  {/* Key Points */}
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider research-panel-label mb-2">
                      Key Points
                    </h4>
                    <ul className="space-y-2">
                      {selectedClause.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-[13px] research-panel-activity-text">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Source Passage - Collapsible */}
                  {selectedClause.citation && (
                    <div>
                      <button
                        onClick={() => setIsSourceExpanded(!isSourceExpanded)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl extraction-source-box text-left hover:opacity-90 transition-opacity"
                      >
                        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider extraction-source-label">
                              Source Passage
                            </h4>
                            {isSourceExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 research-panel-label" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 research-panel-label" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            {selectedClause.citation.pageNumber && (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                Page {selectedClause.citation.pageNumber}
                              </span>
                            )}
                            {!isSourceExpanded && (
                              <span className="research-panel-activity-text-muted truncate">
                                {selectedClause.citation.content.slice(0, 80)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      {isSourceExpanded && (
                        <div className="mt-2 p-4 rounded-lg clause-modal-collapsible-border border">
                          <p className="text-[12px] leading-relaxed research-panel-activity-text whitespace-pre-wrap">
                            {selectedClause.citation.content}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClauseDetailPanel;
