import { type FC, useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import html2pdf from "html2pdf.js";
import type { ResearchData } from "../types/research";
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

const ReportModal: FC<Props> = ({ data: initialData, isOpen, onClose }) => {
  const { researchMessages } = useResearchData();
  const { currentMessageId } = useResearchContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const isMobile = useIsMobile();

  // Get the latest data from context
  const data =
    (currentMessageId && researchMessages.get(currentMessageId)) || initialData;
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (isOpen && !isMobile) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => setShouldAnimate(true), 10);
      return () => {
        clearTimeout(timer);
        setShouldAnimate(false);
        document.body.style.overflow = "";
      };
    }
    return () => {
      setShouldAnimate(false);
      document.body.style.overflow = "";
    };
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

  const handleDownloadPDF = async () => {
    if (!contentRef.current || isDownloading) return;

    setIsDownloading(true);

    try {
      const element = contentRef.current;
      const filename = `${data.title?.replace(/[^a-z0-9]/gi, "_") || "research-report"}.pdf`;

      const opt = {
        margin: [0.75, 0.75, 0.75, 0.75],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: {
          unit: "in",
          format: "letter",
          orientation: "portrait",
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const renderReportContent = () => (
    <>
      {/* Header */}
      <div
        className="report-modal-header"
        style={{
          padding: isMobile ? "16px" : "20px 24px",
          borderBottom: "1px solid",
          display: "flex",
          alignItems: "flex-start",
          gap: "16px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="report-modal-label"
            style={{
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "4px",
            }}
          >
            Research Report
          </div>
          <h1
            className="report-modal-title"
            style={{
              fontSize: isMobile ? "16px" : "18px",
              fontWeight: 600,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {data.title}
          </h1>
        </div>
        {!isMobile && (
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowX: "hidden",
          overflowY: "auto",
          padding: isMobile ? "16px" : "24px 32px",
        }}
        className="report-modal-scroll"
      >
        <div ref={contentRef} style={{ overflow: "hidden" }}>
          {/* Executive Summary */}
          {data.summary && (
            <div
              className="report-modal-summary"
              style={{
                marginBottom: "24px",
                padding: isMobile ? "12px 16px" : "16px 20px",
                border: "1px solid",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="report-modal-summary-label"
                >
                  <path
                    d="M8 1L10 5.5L15 6L11.5 9.5L12.5 14.5L8 12L3.5 14.5L4.5 9.5L1 6L6 5.5L8 1Z"
                    fill="currentColor"
                  />
                </svg>
                <span
                  className="report-modal-summary-label"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.025em",
                  }}
                >
                  Key Takeaways
                </span>
              </div>
              <p
                className="report-modal-summary-text"
                style={{
                  fontSize: "14px",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {data.summary}
              </p>
            </div>
          )}

          {/* Report Content */}
          <div className="report-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1
                    className="report-modal-h1"
                    style={{
                      fontSize: isMobile ? "18px" : "20px",
                      fontWeight: 700,
                      marginTop: "0",
                      marginBottom: "16px",
                      paddingBottom: "12px",
                      borderBottom: "1px solid",
                      lineHeight: 1.3,
                    }}
                  >
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2
                    className="report-modal-h2"
                    style={{
                      fontSize: isMobile ? "15px" : "16px",
                      fontWeight: 600,
                      marginTop: "28px",
                      marginBottom: "12px",
                      lineHeight: 1.4,
                    }}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3
                    className="report-modal-h3"
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      marginTop: "20px",
                      marginBottom: "8px",
                      lineHeight: 1.4,
                    }}
                  >
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p
                    className="report-modal-text"
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.7,
                      marginTop: "0",
                      marginBottom: "12px",
                    }}
                  >
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul
                    className="report-modal-text"
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.7,
                      marginTop: "0",
                      marginBottom: "12px",
                      paddingLeft: "20px",
                    }}
                  >
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol
                    className="report-modal-text"
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.7,
                      marginTop: "0",
                      marginBottom: "12px",
                      paddingLeft: "20px",
                    }}
                  >
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: "4px" }}>{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="report-modal-strong" style={{ fontWeight: 600 }}>
                    {children}
                  </strong>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="report-modal-link"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 6px",
                      margin: "0 2px",
                      fontSize: "11px",
                      fontWeight: 500,
                      borderRadius: "4px",
                      textDecoration: "none",
                      transition: "background-color 0.15s, color 0.15s",
                      verticalAlign: "baseline",
                    }}
                  >
                    {children}
                  </a>
                ),
                hr: () => (
                  <hr
                    className="report-modal-hr"
                    style={{
                      border: "none",
                      borderTop: "1px solid",
                      margin: "24px 0",
                    }}
                  />
                ),
                blockquote: ({ children }) => (
                  <blockquote
                    className="report-modal-blockquote"
                    style={{
                      borderLeft: "3px solid",
                      paddingLeft: "16px",
                      margin: "16px 0",
                      fontStyle: "italic",
                    }}
                  >
                    {children}
                  </blockquote>
                ),
              }}
            >
              {data.result}
            </ReactMarkdown>
          </div>

          {/* Sources Section */}
          {data.sources.length > 0 && (
            <div
              className="report-modal-sources-border"
              style={{
                marginTop: "32px",
                paddingTop: "24px",
                borderTop: "1px solid",
              }}
            >
              <h2
                className="report-modal-h2"
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  marginTop: 0,
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="report-modal-label"
                >
                  <path
                    d="M6 8H10M6 11H10M3 2H13C13.5523 2 14 2.44772 14 3V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6 5H10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Sources ({data.sources.length})
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "10px",
                  overflow: "hidden",
                }}
              >
                {data.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="report-modal-source-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      border: "1px solid",
                      borderRadius: "8px",
                      textDecoration: "none",
                      transition: "all 0.15s",
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    {source.favicon ? (
                      <img
                        src={source.favicon}
                        alt=""
                        style={{
                          width: "16px",
                          height: "16px",
                          flexShrink: 0,
                          borderRadius: "2px",
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="report-modal-source-placeholder"
                        style={{
                          width: "16px",
                          height: "16px",
                          flexShrink: 0,
                          borderRadius: "2px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 16 16"
                          fill="none"
                          className="report-modal-source-url"
                        >
                          <circle
                            cx="8"
                            cy="8"
                            r="7"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="report-modal-source-title"
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {source.title}
                      </div>
                      <div
                        className="report-modal-source-url"
                        style={{
                          fontSize: "11px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {(() => {
                          try {
                            return new URL(source.url).hostname;
                          } catch {
                            return source.url;
                          }
                        })()}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="report-modal-footer"
        style={{
          padding: isMobile ? "12px 16px" : "16px 24px",
          borderTop: "1px solid",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: isMobile ? "0" : "0 0 16px 16px",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? "12px" : "0",
        }}
      >
        <div
          className="report-modal-footer-text"
          style={{
            fontSize: "12px",
            width: isMobile ? "100%" : "auto",
          }}
        >
          {data.sources.length} sources referenced
        </div>
        <div style={{ display: "flex", gap: "8px", width: isMobile ? "100%" : "auto" }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(data.result || "");
            }}
            className="report-modal-btn-secondary"
            style={{
              flex: isMobile ? 1 : undefined,
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              border: "1px solid",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect
                x="5"
                y="5"
                width="9"
                height="9"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M11 5V3C11 2.44772 10.5523 2 10 2H3C2.44772 2 2 2.44772 2 3V10C2 10.5523 2.44772 11 3 11H5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            Copy
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="report-modal-btn-primary"
            style={{
              flex: isMobile ? 1 : undefined,
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              border: "none",
              borderRadius: "8px",
              cursor: isDownloading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              opacity: isDownloading ? 0.6 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2V10M8 10L5 7M8 10L11 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {isDownloading ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>

      <style>{`
        .report-modal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .report-modal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .report-modal-scroll::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        .report-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </>
  );

  if (!isOpen) return null;

  // Mobile: use Drawer
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{data.title}</DrawerTitle>
          </DrawerHeader>
          <div style={{ display: "flex", flexDirection: "column", height: "85vh" }}>
            {renderReportContent()}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: use modal
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          opacity: shouldAnimate ? 1 : 0,
          transition: "opacity 0.2s ease-out",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 51,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          pointerEvents: "none",
        }}
      >
        <div
          className="report-modal"
          style={{
            borderRadius: "16px",
            width: "100%",
            maxWidth: "800px",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            transform: shouldAnimate ? "scale(1)" : "scale(0.95)",
            opacity: shouldAnimate ? 1 : 0,
            transition: "transform 0.2s ease-out, opacity 0.2s ease-out",
            pointerEvents: "auto",
          }}
        >
          {renderReportContent()}
        </div>
      </div>
    </>
  );
};

export default ReportModal;
