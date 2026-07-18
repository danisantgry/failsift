import type { HistoryReport, OutputFormat } from "./types.js";
export declare function renderHistoryReport(report: HistoryReport, format: OutputFormat): string;
export declare function renderHistoryTerminal(report: HistoryReport): string;
export declare function renderHistoryMarkdown(report: HistoryReport): string;
