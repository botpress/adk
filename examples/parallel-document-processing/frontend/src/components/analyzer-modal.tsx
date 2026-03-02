import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AnalyzerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  title: string;
  instructions: string;
  onTitleChange: (title: string) => void;
  onInstructionsChange: (instructions: string) => void;
  onSave: () => void;
}

export function AnalyzerModal({
  open,
  onOpenChange,
  editingId,
  title,
  instructions,
  onTitleChange,
  onInstructionsChange,
  onSave,
}: AnalyzerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Edit Analyzer" : "New Analyzer"}
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? "Update the analyzer's title and instructions."
              : "Create an analyzer with a title and instructions."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Sentiment Analyzer"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              placeholder="Describe what this analyzer should do..."
              rows={4}
              value={instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!title.trim()}>
            {editingId ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
