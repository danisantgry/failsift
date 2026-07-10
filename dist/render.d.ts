import type { AnalysisReport, OutputFormat } from "./types.js";
export declare function renderReport(report: AnalysisReport, format: OutputFormat): string;
export declare function renderTerminal(report: AnalysisReport): string;
export declare function renderMarkdown(report: AnalysisReport): string;
export declare function escapeMarkdown(value: string): string;
