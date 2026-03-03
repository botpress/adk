import { Loader2, Check, CircleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnalyzerCard } from "@/types";

interface AnalyzerCardItemProps {
  card: AnalyzerCard;
  onClick: () => void;
}

export function AnalyzerCardItem({ card, onClick }: AnalyzerCardItemProps) {
  const allPassed =
    card.status === "success" && card.results?.every((r) => r.passed);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={cn(
        "cursor-pointer gap-0 py-3.5 bg-card transition-colors hover:bg-accent/40",
        card.status === "pending_checks" && "border-l-4 border-l-ctp-yellow",
        card.status === "analyzing" && "border-l-4 border-l-muted-foreground/50",
        card.status === "success" &&
          (allPassed
            ? "border-l-4 border-l-ctp-green"
            : "border-l-4 border-l-ctp-red"),
        card.status === "failure" && "border-l-4 border-l-ctp-red",
      )}
    >
      <CardHeader className="px-4 py-0 gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm truncate">{card.title}</CardTitle>
          {card.status === "pending_checks" && (
            <Badge variant="outline" className="shrink-0 text-ctp-yellow border-ctp-yellow/40">
              Review
            </Badge>
          )}
          {card.status === "analyzing" && (
            <Badge variant="secondary" className="shrink-0">
              <Loader2 className="size-3 animate-spin" />
              Running
            </Badge>
          )}
          {card.status === "success" && (
            <Badge
              variant={allPassed ? "default" : "destructive"}
              className={cn("shrink-0", allPassed && "bg-ctp-green hover:bg-ctp-green text-background")}
            >
              <Check className="size-3" />
              {card.results?.filter((r) => r.passed).length}/{card.results?.length}
            </Badge>
          )}
          {card.status === "failure" && (
            <Badge variant="destructive" className="shrink-0">
              <CircleAlert className="size-3" />
              Failed
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          {card.status === "pending_checks" && "Checks ready for review"}
          {card.status === "analyzing" && "Analysis in progress..."}
          {card.status === "success" &&
            (allPassed
              ? "All checks passed"
              : `${card.results?.filter((r) => r.passed).length} of ${card.results?.length} checks passed`)}
          {card.status === "failure" && (card.error || "Analysis failed")}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
