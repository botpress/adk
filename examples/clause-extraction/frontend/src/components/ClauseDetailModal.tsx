import { type FC, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Copy, Check } from "lucide-react";
import type { Clause } from "../types/extraction";
import { CLAUSE_TYPE_LABELS, RISK_COLORS } from "../config/constants";
import clsx from "clsx";

type Props = {
  clause: Clause | null;
  isOpen: boolean;
  onClose: () => void;
};

const ClauseDetailModal: FC<Props> = ({ clause, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!clause) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(clause.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          className="clause-modal fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh]
                     rounded-xl shadow-2xl z-50 flex flex-col animate-fade-in"
        >
          {/* Header */}
          <div className="clause-modal-header flex-shrink-0 px-6 py-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={clsx(
                      "px-2 py-1 text-[11px] font-semibold rounded-md capitalize",
                      RISK_COLORS[clause.riskLevel].badge
                    )}
                  >
                    {clause.riskLevel} Risk
                  </span>
                  <span className="clause-modal-type-badge px-2 py-1 text-[11px] font-medium rounded-md">
                    {CLAUSE_TYPE_LABELS[clause.clauseType] || clause.clauseType}
                  </span>
                </div>
                <Dialog.Title className="clause-modal-title text-xl font-semibold leading-tight">
                  {clause.title}
                </Dialog.Title>
                {clause.section && (
                  <p className="clause-modal-section text-sm mt-1">{clause.section}</p>
                )}
              </div>
              <Dialog.Close asChild>
                <button className="clause-modal-close-btn p-2 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Full Text */}
            <div>
              <h3 className="clause-modal-heading text-sm font-semibold mb-3">Full Clause Text</h3>
              <div className="clause-modal-collapsible-border border rounded-lg p-4">
                <p className="clause-modal-text text-sm leading-relaxed whitespace-pre-wrap">
                  {clause.text}
                </p>
              </div>
            </div>

            {/* Key Points */}
            <div>
              <h3 className="clause-modal-heading text-sm font-semibold mb-3">Key Points</h3>
              <ul className="space-y-2">
                {clause.keyPoints.map((point, idx) => (
                  <li key={idx} className="clause-modal-text flex items-start gap-3 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="clause-modal-footer flex-shrink-0 px-6 py-4 border-t flex items-center justify-end gap-3">
            <button
              onClick={handleCopy}
              className="clause-modal-btn-secondary flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Text
                </>
              )}
            </button>
            <Dialog.Close asChild>
              <button className="clause-modal-btn-primary px-4 py-2 text-sm font-medium rounded-lg transition-colors">
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ClauseDetailModal;
