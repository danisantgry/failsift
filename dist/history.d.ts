import type { AnalysisReport, HistoryReport, HistoryRunReference } from "./types.js";
export interface HistoryAnalysis {
    report: AnalysisReport;
    run: HistoryRunReference;
}
export declare function buildHistoryReport(repository: string, workflow: string, analyses: HistoryAnalysis[]): HistoryReport;
