import { useState } from "react";
import { Plus, Trash2, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnalyzerCard } from "@/types";

interface ChecksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: AnalyzerCard | undefined;
  onConfirm: (analyzerId: string, checks: string[]) => void;
}

export function ChecksModal({
  open,
  onOpenChange,
  card,
  onConfirm,
}: ChecksModalProps) {
  // Initialized from card.checks on mount — each card gets a fresh
  // instance because App.tsx keys this component by selectedCardId.
  const [editedChecks, setEditedChecks] = useState<string[]>(
    () => (card?.status === "pending_checks" && card.checks) ? [...card.checks] : [],
  );

  if (!card) return null;

  const updateCheck = (index: number, value: string) => {
    setEditedChecks((prev) => prev.map((c, i) => (i === index ? value : c)));
  };

  const removeCheck = (index: number) => {
    setEditedChecks((prev) => prev.filter((_, i) => i !== index));
  };

  const addCheck = () => {
    setEditedChecks((prev) => [...prev, ""]);
  };

  const handleConfirm = () => {
    const filtered = editedChecks.filter((c) => c.trim() !== "");
    if (filtered.length === 0) return;
    onConfirm(card.analyzerId, filtered);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{card.title}</DialogTitle>
          <DialogDescription>
            {card.status === "pending_checks" &&
              "Review and edit the generated checks before running the analysis."}
            {card.status === "analyzing" && "Analysis is in progress."}
            {card.status === "success" && "Analysis complete. See results below."}
            {card.status === "failure" && "Analysis failed."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {/* Pending checks — editable */}
          {card.status === "pending_checks" &&
            editedChecks.map((check, i) => (
              <div key={i} className="flex items-start gap-2">
                <Textarea
                  value={check}
                  onChange={(e) => updateCheck(i, e.target.value)}
                  placeholder="Enter a yes/no check..."
                  rows={2}
                  className="flex-1 min-h-0 resize-none field-sizing-content"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCheck(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          {card.status === "pending_checks" && (
            <Button
              variant="outline"
              size="sm"
              onClick={addCheck}
              className="mt-1"
            >
              <Plus className="size-4 mr-1" />
              Add check
            </Button>
          )}

          {/* Analyzing — read-only with spinner */}
          {card.status === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Running checks against the document...
              </p>
            </div>
          )}

          {/* Success / Failure — results list */}
          {(card.status === "success" || card.status === "failure") &&
            card.results && (
              <ul className="space-y-3">
                {card.results.map((result, i) => (
                  <li
                    key={i}
                    className={cn(
                      "rounded-lg border p-3",
                      result.passed
                        ? "border-ctp-green/30 bg-ctp-green/10"
                        : "border-ctp-red/30 bg-ctp-red/10",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {result.passed ? (
                        <Check className="size-4 mt-0.5 shrink-0 text-ctp-green" />
                      ) : (
                        <X className="size-4 mt-0.5 shrink-0 text-ctp-red" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{result.check}</p>
                          <Badge
                            variant={result.passed ? "default" : "destructive"}
                            className={cn(
                              "shrink-0",
                              result.passed && "bg-ctp-green hover:bg-ctp-green text-background",
                            )}
                          >
                            {result.passed ? "Pass" : "Fail"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.explanation}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

          {/* Failure with no results */}
          {card.status === "failure" && !card.results && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <p className="text-sm text-destructive font-medium">
                {card.error || "The analysis encountered an error."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {card.status === "pending_checks" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={editedChecks.filter((c) => c.trim()).length === 0}
              >
                Confirm & Analyze
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
