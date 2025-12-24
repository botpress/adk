export type ExtractionStatus = "pending" | "in_progress" | "summarizing" | "done" | "error" | "cancelled";

export type ActivityType = "reading" | "extracting" | "reviewing" | "storing" | "summarizing" | "complete";
export type ActivityStatus = "pending" | "in_progress" | "done" | "error";

export type RiskLevel = "low" | "medium" | "high";

export interface Activity {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  text: string;
  clauseType?: string;
  timestamp?: string;
}

export interface Citation {
  passageId: string;
  pageNumber?: number;
  content: string;
}

export interface Clause {
  id: number;
  clauseType: string;
  title: string;
  section?: string;
  text: string;
  keyPoints: string[];
  riskLevel: RiskLevel;
  citation?: Citation;
}

export interface Source {
  fileId: string;
  fileName: string;
}

export interface PassageStats {
  total: number;
  processed: number;
  skipped: number;
  withClauses: number;
}

export interface CurrentBatch {
  index: number;
  total: number;
  sectionHeader?: string;
  passageCount: number;
  pageRange?: { start: number; end: number };
}

export interface ExtractionData {
  progress: number;
  status: ExtractionStatus;
  topic: string; // Document name from backend
  clausesFound: number;
  sources: Source[];
  activities: Activity[];
  clauses?: Clause[]; // Optional - populated after extraction completes
  clausesByType?: Record<string, number>; // Optional - computed from clauses
  error?: string;
  passageStats?: PassageStats;
  currentBatch?: CurrentBatch;
  summary?: string; // Contract summary - populated after summarization phase
}
