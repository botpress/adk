import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileDropZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  isConnected: boolean;
  hasActiveCards: boolean;
}

export function FileDropZone({
  file,
  onFileChange,
  onRunAnalysis,
  isAnalyzing,
  isConnected,
  hasActiveCards,
}: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFileChange(dropped);
    },
    [onFileChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <div
      className={cn(
        "flex items-center justify-center border-b px-6 shrink-0 h-[25vh] bg-card/50 transition-all",
        dragOver
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
          : "border-border",
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {file ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary/80 shrink-0" />
            <p className="font-medium text-sm truncate">{file.name}</p>
            <span className="text-muted-foreground text-xs shrink-0">
              {formatFileSize(file.size)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onFileChange(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={onRunAnalysis}
            disabled={!isConnected || isAnalyzing || hasActiveCards}
          >
            {isAnalyzing ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Play className="size-4 mr-2" />
            )}
            {isAnalyzing ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>
      ) : (
        <>
          <Upload className="size-5 text-muted-foreground/50 mr-3 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Drag and drop a file here, or{" "}
            <button
              type="button"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={() => fileInputRef.current?.click()}
            >
              browse
            </button>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) onFileChange(selected);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
