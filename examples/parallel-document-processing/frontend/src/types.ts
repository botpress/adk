export interface Analyzer {
  id: string;
  title: string;
  instructions: string;
}

export interface CheckResult {
  check: string;
  passed: boolean;
  explanation: string;
}

export type AnalyzerCardStatus =
  | "pending_checks"
  | "analyzing"
  | "success"
  | "failure";

export interface AnalyzerCard {
  analyzerId: string;
  title: string;
  status: AnalyzerCardStatus;
  checks?: string[];
  results?: CheckResult[];
  error?: string;
}
