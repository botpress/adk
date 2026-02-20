import { type FC, useEffect, useState } from "react";
import type { ImportData } from "../types/import";
import { useImportData } from "../context/ImportDataContext";
import { useImportContext } from "../context/ImportContext";

type Props = {
  data: ImportData;
  isOpen: boolean;
  onClose: () => void;
};

const ImportSummaryModal: FC<Props> = ({ data: initialData, isOpen, onClose }) => {
  const { importMessages } = useImportData();
  const { currentMessageId } = useImportContext();
  const data =
    (currentMessageId && importMessages.get(currentMessageId)) || initialData;
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (isOpen) {
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

  const total = data.totalRows ?? 0;
  const imported = data.importedRows ?? 0;
  const skipped = data.skippedRows ?? 0;
  const errorCount = data.errors?.length ?? 0;
  const isFailed = data.status === "errored" || data.status === "cancelled";

  const renderContent = () => (
    <>
      <div
        className="summary-modal-header"
        style={{
          padding: "20px 24px",
          borderBottomWidth: "1px",
          borderBottomStyle: "solid",
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          {isFailed ? (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="14" fill="#ef4444" opacity="0.15" />
              <circle cx="14" cy="14" r="10" fill="#ef4444" />
              <path d="M10 10L18 18M18 10L10 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="14" fill="#10b981" opacity="0.15" />
              <circle cx="14" cy="14" r="10" fill="#10b981" />
              <path d="M18 11L12.5 16.5L10 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="summary-modal-title" style={{ fontSize: "16px", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
            {data.fileName}
          </h1>
          <div className="summary-modal-label" style={{ fontSize: "13px", marginTop: "2px" }}>
            {isFailed ? "Import failed" : `${imported} of ${total} rows imported`}
          </div>
        </div>
        <button
          onClick={onClose}
          className="summary-modal-close-btn"
          style={{ padding: "8px", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer", color: "#696F83", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div
        style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}
        className="summary-modal-scroll"
      >
        <div className="summary-stats-row" style={{ display: "flex", borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
          <div className="summary-stat-cell" style={{ flex: 1, padding: "14px 12px", textAlign: "center" }}>
            <div className="summary-stat-value" style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1 }}>{total}</div>
            <div className="summary-stat-label" style={{ fontSize: "11px", marginTop: "5px" }}>Total</div>
          </div>
          <div className="summary-stat-cell" style={{ flex: 1, padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1, color: "#10b981" }}>{imported}</div>
            <div className="summary-stat-label" style={{ fontSize: "11px", marginTop: "5px" }}>Imported</div>
          </div>
          <div className="summary-stat-cell" style={{ flex: 1, padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1, color: skipped > 0 ? "#f59e0b" : undefined }}>{skipped}</div>
            <div className="summary-stat-label" style={{ fontSize: "11px", marginTop: "5px" }}>Skipped</div>
          </div>
          {errorCount > 0 && (
            <div className="summary-stat-cell" style={{ flex: 1, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1, color: "#ef4444" }}>{errorCount}</div>
              <div className="summary-stat-label" style={{ fontSize: "11px", marginTop: "5px" }}>Errors</div>
            </div>
          )}
        </div>

        {data.errors && data.errors.length > 0 && (
          <div>
            <div className="summary-section-title" style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Errors
            </div>
            <div className="summary-errors-list" style={{ maxHeight: "200px", overflowY: "auto", borderRadius: "8px" }}>
              {data.errors.map((error, index) => (
                <div key={index} className="summary-error-item" style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                  lineHeight: 1.4,
                  fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
                }}>
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className="summary-modal-footer"
        style={{
          padding: "14px 24px",
          borderTopWidth: "1px",
          borderTopStyle: "solid",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: "0 0 16px 16px",
        }}
      >
        <span className="summary-footer-hint" style={{ fontSize: "12px" }}>
          Click <strong>New</strong> to import another file
        </span>
        <button
          onClick={onClose}
          className="summary-modal-btn-primary"
          style={{
            padding: "8px 20px",
            fontSize: "13px",
            fontWeight: 500,
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Done
        </button>
      </div>

      <style>{`
        .summary-modal-scroll::-webkit-scrollbar { width: 4px; }
        .summary-modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .summary-modal-scroll::-webkit-scrollbar-thumb { background: #3F434F; border-radius: 2px; }
        .summary-errors-list::-webkit-scrollbar { width: 4px; }
        .summary-errors-list::-webkit-scrollbar-track { background: transparent; }
        .summary-errors-list::-webkit-scrollbar-thumb { background: #3F434F; border-radius: 2px; }
      `}</style>
    </>
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          opacity: shouldAnimate ? 1 : 0,
          transition: "opacity 0.2s ease-out",
        }}
      />
      <div style={{ position: "fixed", inset: 0, zIndex: 51, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
        <div
          className="summary-modal"
          style={{
            borderRadius: "16px",
            width: "100%",
            maxWidth: "480px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            transform: shouldAnimate ? "scale(1)" : "scale(0.95)",
            opacity: shouldAnimate ? 1 : 0,
            transition: "transform 0.2s ease-out, opacity 0.2s ease-out",
            pointerEvents: "auto",
          }}
        >
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default ImportSummaryModal;
