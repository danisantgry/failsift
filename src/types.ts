export type Confidence = "high" | "medium" | "low";
export type OutputFormat = "terminal" | "markdown" | "json";

export interface AnalysisSource {
  kind: "file" | "stdin" | "github" | "text";
  label: string;
  repository?: string;
  runId?: number;
  jobs?: string[];
  runUrl?: string;
  workflowId?: number;
}

export interface InputLimits {
  maxBytes: number;
  maxLines: number;
}

export interface LimitsApplied extends InputLimits {
  bytesRead: number;
  linesRead: number;
  truncated: false;
}

export interface NormalizedLine {
  number: number;
  text: string;
}

export interface FailureCandidate {
  parser: string;
  framework: string;
  category: string;
  message: string;
  lineNumber: number;
  score: number;
  file?: string;
  sourceLine?: number;
  column?: number;
  suggestion?: string;
  cascade?: boolean;
}

export interface Failure {
  parser: string;
  framework: string;
  category: string;
  message: string;
  logLine: number;
  fingerprint: string;
  file?: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface AnalysisReport {
  schemaVersion: 1;
  source: AnalysisSource;
  summary: string;
  primaryFailure: Failure | null;
  secondaryFailures: Failure[];
  frameworks: string[];
  suggestions: string[];
  fingerprint: string | null;
  confidence: Confidence;
  redactionCount: number;
  limitsApplied: LimitsApplied;
  reductionPercent: number;
}

export interface HistoryRunReference {
  runId: number;
  runNumber: number;
  runUrl: string;
  createdAt: string;
}

export interface HistoryFailureGroup {
  fingerprint: string;
  framework: string;
  category: string;
  message: string;
  file?: string;
  occurrences: number;
  sharePercent: number;
  runs: HistoryRunReference[];
}

export interface HistoryReport {
  schemaVersion: 1;
  source: {
    kind: "github-history";
    repository: string;
    workflow: string;
  };
  runsAnalyzed: number;
  actionableRuns: number;
  unclassifiedRuns: HistoryRunReference[];
  uniqueFingerprints: number;
  recurringFingerprints: number;
  redactionCount: number;
  failureGroups: HistoryFailureGroup[];
}

export interface AnalyzeOptions {
  source: AnalysisSource;
  limits?: Partial<InputLimits>;
}

export interface RedactionResult {
  text: string;
  count: number;
}

export interface Parser {
  id: string;
  parse(lines: NormalizedLine[]): FailureCandidate[];
}
