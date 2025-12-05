import { type FC, useState, useEffect } from "react";
import type { ResearchData, Activity } from "../types/research";
import { useResearchData } from "../context/ResearchDataContext";
import { useResearchContext } from "../context/ResearchContext";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";

type Props = {
  data: ResearchData;
  isOpen: boolean;
  onClose: () => void;
};

const ResearchPanel: FC<Props> = ({ data: initialData, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"activity" | "sources">(
    "activity"
  );
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const { researchMessages } = useResearchData();
  const { currentMessageId } = useResearchContext();
  const isMobile = useIsMobile();

  // Get the latest data from context
  const data =
    (currentMessageId && researchMessages.get(currentMessageId)) || initialData;

  useEffect(() => {
    if (isOpen && !isMobile) {
      const timer = setTimeout(() => setShouldAnimate(true), 10);
      return () => {
        clearTimeout(timer);
        setShouldAnimate(false);
      };
    }
    return () => setShouldAnimate(false);
  }, [isOpen, isMobile]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const renderActivityItem = (
    activity: Activity,
    index: number,
    isLast: boolean,
    isFirst: boolean
  ) => {
    const hasError = activity.status === "error";
    const isInProgress = activity.status === "in_progress";
    const isDone = activity.status === "done";
    const isCurrent = isFirst; // First item (most recent) is current

    const getIcon = () => {
      if (hasError) {
        return (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill="#ef4444" />
            <path
              d="M5 5L11 11M11 5L5 11"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      }

      if (activity.type === "search") {
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            style={{ color: "#6b7280" }}
          >
            <circle
              cx="7"
              cy="7"
              r="5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M11 11L14 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      }
      if (activity.type === "readPage") {
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            style={{ color: "#6b7280" }}
          >
            <path
              d="M3 2H13V14H3V2Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M5 5H11M5 8H11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      }
      if (activity.type === "writing") {
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            style={{ color: "#6b7280" }}
          >
            <path
              d="M2 14L3.5 8.5L11 1L15 5L7.5 12.5L2 14Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        );
      }
      if (activity.type === "thinking") {
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            style={{ color: "#6b7280" }}
          >
            <circle
              cx="8"
              cy="8"
              r="5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="8" cy="8" r="2" fill="currentColor" />
          </svg>
        );
      }
      // pending
      return (
        <div
          style={{
            width: "6px",
            height: "6px",
            backgroundColor: "#d1d5db",
            borderRadius: "50%",
          }}
        />
      );
    };

    const getFaviconOrIcon = () => {
      // For readPage type, show favicon or generic website icon
      if (activity.type === "readPage") {
        if (activity.favicon && activity.favicon.length > 0) {
          return (
            <img
              src={activity.favicon}
              alt=""
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "2px",
              }}
              onError={(e) => {
                // Hide broken images
                e.currentTarget.style.display = "none";
              }}
            />
          );
        }
        // Generic website/globe icon
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            style={{ color: "#9ca3af" }}
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <ellipse
              cx="8"
              cy="8"
              rx="2.5"
              ry="6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M2 8H14" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      }
      // For other types, use the type-based icon
      return getIcon();
    };

    // Timeline dot color
    const getDotColor = () => {
      if (hasError) return "#ef4444";
      if (isInProgress) return "#3b82f6";
      if (isDone) return "#10b981";
      return "#d1d5db";
    };

    return (
      <div
        key={activity.id || index}
        style={{
          display: "flex",
          gap: "12px",
          position: "relative",
        }}
      >
        {/* Timeline column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "20px",
            flexShrink: 0,
          }}
        >
          {/* Dot */}
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: getDotColor(),
              border: "2px solid white",
              boxShadow: "0 0 0 2px " + getDotColor() + "30",
              zIndex: 1,
              animation: isInProgress
                ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                : undefined,
            }}
          />
          {/* Vertical line (hidden for last item) */}
          {!isLast && (
            <div
              style={{
                flex: 1,
                width: "2px",
                backgroundColor: "#e5e7eb",
                marginTop: "4px",
              }}
            />
          )}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            paddingBottom: isLast ? "0" : "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {/* Icon */}
            <div
              style={{
                flexShrink: 0,
                width: "18px",
                height: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {getFaviconOrIcon()}
            </div>
            {/* Text */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "13px",
                lineHeight: 1.4,
                color: hasError ? "#dc2626" : isCurrent ? "#374151" : "#9ca3af",
                fontWeight: isCurrent ? 500 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {activity.text}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPanelContent = () => (
    <>
      {/* Header */}
      <div
        className="research-panel-header"
        style={{
          flexShrink: 0,
          padding: "16px",
          borderBottom: "1px solid",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
            <div
              className="research-panel-label"
              style={{
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "4px",
              }}
            >
              Researching
            </div>
            <h2
              className="research-panel-title"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                margin: 0,
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {data.title}
            </h2>
          </div>
          {!isMobile && (
            <button
              onClick={onClose}
              style={{
                padding: "6px",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#9ca3af",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f3f4f6";
                e.currentTarget.style.color = "#6b7280";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#9ca3af";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M6 6L14 14M14 6L6 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Progress */}
        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "6px",
            }}
          >
            <span className="research-panel-progress-text" style={{ fontSize: "11px" }}>Progress</span>
            <span
              className="research-panel-progress-text"
              style={{ fontSize: "11px", fontWeight: 500 }}
            >
              {data.progress}%
            </span>
          </div>
          <div
            className="research-panel-progress-track"
            style={{
              width: "100%",
              height: "4px",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                backgroundColor:
                  data.status === "errored"
                    ? "#ef4444"
                    : data.status === "cancelled"
                      ? "#f59e0b"
                      : data.status === "done"
                        ? "#10b981"
                        : "#3b82f6",
                width: `${data.progress}%`,
                transition: "width 0.3s ease",
                borderRadius: "2px",
              }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div
          className="research-panel-tabs"
          style={{
            display: "flex",
            gap: "4px",
            borderRadius: "8px",
            padding: "3px",
          }}
        >
          <button
            onClick={() => setActiveTab("activity")}
            className={activeTab === "activity" ? "research-panel-tab-active" : "research-panel-tab"}
            style={{
              flex: 1,
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow:
                activeTab === "activity"
                  ? "0 1px 2px rgba(0, 0, 0, 0.05)"
                  : "none",
            }}
          >
            Activity
          </button>
          <button
            onClick={() => setActiveTab("sources")}
            className={activeTab === "sources" ? "research-panel-tab-active" : "research-panel-tab"}
            style={{
              flex: 1,
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow:
                activeTab === "sources"
                  ? "0 1px 2px rgba(0, 0, 0, 0.05)"
                  : "none",
            }}
          >
            {data.sources.length} Sources
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
        }}
        className="panel-scroll"
      >
        {activeTab === "activity" && (
          <div>
            {[...data.activities]
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
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  padding: "10px 0",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      backgroundColor: "#3b82f6",
                      borderRadius: "50%",
                      animation:
                        "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                    }}
                  />
                </div>
                <span style={{ fontSize: "13px", color: "#9ca3af" }}>
                  Starting research...
                </span>
              </div>
            )}

            {/* Error Message */}
            {data.error && data.status === "errored" && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                }}
              >
                <div style={{ fontSize: "12px", color: "#dc2626" }}>
                  <strong>Failed:</strong> {data.error}
                </div>
              </div>
            )}

            {/* Cancelled Message */}
            {data.status === "cancelled" && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "8px",
                }}
              >
                <div style={{ fontSize: "12px", color: "#b45309" }}>
                  <strong>Cancelled:</strong>{" "}
                  {data.error || "Research was cancelled."}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "sources" && (
          <div>
            {data.sources.length > 0 ? (
              data.sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    gap: "10px",
                    padding: "10px 0",
                    borderBottom: "1px solid #f3f4f6",
                    textDecoration: "none",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.7";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  <div style={{ flexShrink: 0, paddingTop: "2px" }}>
                    {source.favicon ? (
                      <img
                        src={source.favicon}
                        alt=""
                        style={{ width: "14px", height: "14px" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          backgroundColor: "#e5e7eb",
                          borderRadius: "3px",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#374151",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {source.title}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        marginTop: "2px",
                      }}
                    >
                      {new URL(source.url).hostname}
                    </div>
                  </div>
                </a>
              ))
            ) : (
              <div
                style={{
                  padding: "32px 0",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "13px",
                }}
              >
                No sources yet
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .panel-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .panel-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .panel-scroll::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 2px;
        }
        .panel-scroll::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </>
  );

  // Mobile: use Drawer
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{data.title}</DrawerTitle>
          </DrawerHeader>
          <div style={{ display: "flex", flexDirection: "column", height: "75vh" }}>
            {renderPanelContent()}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: use side panel
  return (
    <div
      className="research-panel"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "340px",
        borderLeft: "1px solid",
        display: "flex",
        flexDirection: "column",
        transform: shouldAnimate ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 40,
        boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.05)",
      }}
    >
      {renderPanelContent()}
    </div>
  );
};

export default ResearchPanel;
