import { useCallback, useState } from "react";
import type { AnalyzerCard, CheckResult } from "@/types";

export function useAnalyzerCards() {
  const [cards, setCards] = useState<Map<string, AnalyzerCard>>(new Map());

  const handleWorkflowRequest = useCallback(
    (analyzerId: string, title: string, checks: string[]) => {
      setCards((prev) => {
        const next = new Map(prev);
        next.set(analyzerId, {
          analyzerId,
          title,
          status: "pending_checks",
          checks,
        });
        return next;
      });
    },
    [],
  );

  const markAnalyzing = useCallback((analyzerId: string) => {
    setCards((prev) => {
      const next = new Map(prev);
      const card = next.get(analyzerId);
      if (card) {
        next.set(analyzerId, { ...card, status: "analyzing" });
      }
      return next;
    });
  }, []);

  const handleSuccess = useCallback(
    (analyzerId: string, title: string, results: CheckResult[]) => {
      setCards((prev) => {
        const next = new Map(prev);
        next.set(analyzerId, {
          analyzerId,
          title,
          status: "success",
          results,
        });
        return next;
      });
    },
    [],
  );

  const handleFailure = useCallback((analyzerId: string, error?: string) => {
    setCards((prev) => {
      const next = new Map(prev);
      const card = next.get(analyzerId);
      next.set(analyzerId, {
        analyzerId,
        title: card?.title ?? "Analysis",
        status: "failure",
        error,
      });
      return next;
    });
  }, []);

  const clearCards = useCallback(() => {
    setCards(new Map());
  }, []);

  return {
    cards,
    handleWorkflowRequest,
    markAnalyzing,
    handleSuccess,
    handleFailure,
    clearCards,
  };
}
