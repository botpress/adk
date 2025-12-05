import { type FC, useEffect } from "react";
import type { ResearchData, ResearchStep } from "../types/research";

type Props = {
  data: ResearchData;
  isOpen: boolean;
  onClose: () => void;
};

const ResearchTray: FC<Props> = ({ data, isOpen, onClose }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderStep = (step: ResearchStep, index: number) => {
    const getStepIcon = () => {
      if (step.status === 'pending') return '⏸️';
      if (step.status === 'in_progress') return '⏳';
      if (step.status === 'error') return '❌';
      return '✅';
    };

    const getStepTitle = () => {
      switch (step.type) {
        case 'search':
          return 'Search';
        case 'readPage':
          return 'Reading Page';
        case 'writing':
          return 'Writing';
        case 'pending':
          return 'Pending';
        default:
          return 'Step';
      }
    };

    return (
      <div
        key={index}
        className="research-tray-step"
        style={{
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "8px",
          border: "1px solid",
        }}
      >
        {/* Step Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <span style={{ fontSize: "16px" }}>{getStepIcon()}</span>
          <span
            style={{
              fontWeight: 600,
              fontSize: "14px",
              color: "inherit",
            }}
          >
            {getStepTitle()}
          </span>
        </div>

        {/* Step-specific content */}
        {step.type === 'search' && (
          <div style={{ marginBottom: "8px" }}>
            <div
              style={{
                fontSize: "12px",
                opacity: 0.7,
                marginBottom: "4px",
              }}
            >
              Search terms:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {step.searches.map((term, i) => (
                <span
                  key={i}
                  className="research-tray-tag"
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
        )}

        {step.type === 'readPage' && (
          <div style={{ marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {step.favicon && (
                <img
                  src={step.favicon}
                  alt=""
                  style={{ width: "16px", height: "16px" }}
                />
              )}
              <a
                href={step.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "12px",
                  color: "#0090FF",
                  textDecoration: "none",
                  wordBreak: "break-all",
                }}
              >
                {step.url}
              </a>
            </div>
            {step.error && (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#ef4444",
                }}
              >
                Error: {step.error}
              </div>
            )}
          </div>
        )}

        {step.type === 'writing' && (
          <div style={{ marginBottom: "8px" }}>
            <div
              style={{
                fontSize: "12px",
                opacity: 0.7,
              }}
            >
              Section: <strong>{step.section}</strong>
            </div>
            {step.error && (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#ef4444",
                }}
              >
                Error: {step.error}
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {step.preview && (
          <div
            className="research-tray-preview"
            style={{
              fontSize: "12px",
              fontStyle: "italic",
              paddingLeft: "8px",
              borderLeft: "2px solid",
            }}
          >
            {step.preview}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 9999,
          animation: "fadeIn 0.2s ease",
        }}
        onClick={onClose}
      />

      {/* Tray */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "500px",
          maxWidth: "90vw",
          height: "100vh",
          background: "#ffffff",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.2)",
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.3s ease",
        }}
        className="research-tray"
      >
        {/* Header */}
        <div
          className="research-tray-header"
          style={{
            padding: "20px",
            borderBottom: "1px solid #e5e5e5",
            background: "#f9f9f9",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "12px",
            }}
          >
            <div style={{ flex: 1 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "inherit",
                  marginBottom: "4px",
                }}
              >
                {data.title}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  opacity: 0.7,
                }}
              >
                {data.topic}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "var(--bpGray-500)",
                padding: "0",
                lineHeight: "1",
              }}
            >
              ×
            </button>
          </div>

          {/* Progress */}
          <div style={{ marginTop: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
                fontSize: "12px",
                color: "var(--bpGray-600)",
              }}
            >
              <span>Progress</span>
              <span>{data.progress}%</span>
            </div>
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "var(--bpGray-200)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${data.progress}%`,
                  height: "100%",
                  background:
                    data.status === 'errored'
                      ? "#ef4444"
                      : data.status === 'done'
                      ? "#10b981"
                      : "var(--primary-color)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>

          {/* Meta info */}
          <div
            style={{
              marginTop: "12px",
              fontSize: "12px",
              color: "var(--bpGray-600)",
              display: "flex",
              gap: "16px",
            }}
          >
            <span>Started: {new Date(data.startedAt).toLocaleString()}</span>
            <span>Status: {data.status}</span>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
          }}
        >
          {/* Steps */}
          <div style={{ marginBottom: "24px" }}>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 600,
                marginBottom: "12px",
                color: "var(--bpGray-900)",
              }}
            >
              Research Steps
            </h3>
            {data.steps.map((step, index) => renderStep(step, index))}
          </div>

          {/* Sources */}
          {data.sources.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  marginBottom: "12px",
                  color: "var(--bpGray-900)",
                }}
              >
                Sources ({data.sources.length})
              </h3>
              {data.sources.map((source, index) => (
                <div
                  key={index}
                  className="research-tray-source"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    marginBottom: "6px",
                    border: "1px solid",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {source.favicon && (
                      <img
                        src={source.favicon}
                        alt=""
                        style={{ width: "16px", height: "16px" }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "var(--bpGray-900)",
                          marginBottom: "2px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {source.title}
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "11px",
                          color: "var(--bpGray-600)",
                          textDecoration: "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {source.url}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {data.result && data.status === 'done' && (
            <div>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  marginBottom: "12px",
                  color: "var(--bpGray-900)",
                }}
              >
                Final Report
              </h3>
              <a
                href={data.result}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  padding: "12px",
                  background: "var(--primary-color)",
                  color: "white",
                  textAlign: "center",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: 500,
                  fontSize: "14px",
                }}
              >
                View Report →
              </a>
            </div>
          )}

          {/* Error */}
          {data.error && data.status === 'errored' && (
            <div
              style={{
                padding: "12px",
                background: "#fee",
                border: "1px solid #fcc",
                borderRadius: "8px",
                color: "#c00",
                fontSize: "13px",
              }}
            >
              <strong>Error:</strong> {data.error}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ResearchTray;
