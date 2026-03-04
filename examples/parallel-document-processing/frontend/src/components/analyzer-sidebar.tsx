import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalyzerCardItem } from "@/components/analyzer-card-item";
import type { Analyzer, AnalyzerCard } from "@/types";

interface AnalyzerSidebarProps {
  analyzers: Analyzer[];
  cards: Map<string, AnalyzerCard>;
  onAddAnalyzer: () => void;
  onEditAnalyzer: (analyzer: Analyzer) => void;
  onDeleteAnalyzer: (id: string) => void;
  onCardClick: (analyzerId: string) => void;
}

export function AnalyzerSidebar({
  analyzers,
  cards,
  onAddAnalyzer,
  onEditAnalyzer,
  onDeleteAnalyzer,
  onCardClick,
}: AnalyzerSidebarProps) {
  const cardList = Array.from(cards.values());

  return (
    <aside className="flex-1 overflow-hidden flex flex-col bg-sidebar">
      <div className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-border">
        <h2 className="font-semibold text-sm tracking-tight text-foreground/90">Analyzers</h2>
        <Button size="sm" variant="secondary" className="h-7 text-xs px-2.5" onClick={onAddAnalyzer}>
          <Plus className="size-3.5 mr-1" />
          Add
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {analyzers.length === 0 ? (
          <p className="text-muted-foreground/60 text-xs text-center mt-16 px-4 leading-relaxed">
            No analyzers yet. Click "Add" to create one.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {analyzers.map((analyzer) => (
              <li
                key={analyzer.id}
                className="group flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-accent/50 transition-colors border border-border max-w-xs"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {analyzer.title}
                  </p>
                  {analyzer.instructions && (
                    <p className="text-muted-foreground text-xs truncate mt-0.5">
                      {analyzer.instructions}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onEditAnalyzer(analyzer)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteAnalyzer(analyzer.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {cardList.length > 0 && (
          <>
            <div className="border-t border-border my-4 mx-0" />
            <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">
              Running Analyses
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cardList.map((card) => (
                <AnalyzerCardItem
                  key={card.analyzerId}
                  card={card}
                  onClick={() => onCardClick(card.analyzerId)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
