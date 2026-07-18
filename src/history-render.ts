import { escapeMarkdown } from "./render.js";
import type { HistoryFailureGroup, HistoryReport, OutputFormat } from "./types.js";

const DISPLAY_LIMIT = 10;

export function renderHistoryReport(report: HistoryReport, format: OutputFormat): string {
  if (format === "json") return `${JSON.stringify(report, null, 2)}\n`;
  if (format === "markdown") return renderHistoryMarkdown(report);
  return renderHistoryTerminal(report);
}

export function renderHistoryTerminal(report: HistoryReport): string {
  const lines = [
    "FailSift failure history",
    `Repository: ${report.source.repository}`,
    `Workflow: ${report.source.workflow}`,
    `Analyzed: ${report.runsAnalyzed} failed runs (${report.actionableRuns} actionable)`,
    ""
  ];
  if (report.failureGroups.length === 0) {
    lines.push("No actionable failure fingerprints were detected.");
  } else {
    lines.push(report.recurringFingerprints > 0 ? "Recurring failure groups:" : "Failure groups:");
    for (const [index, group] of report.failureGroups.slice(0, DISPLAY_LIMIT).entries()) {
      lines.push(`${index + 1}. ${group.occurrences}x / ${group.sharePercent}% [${group.framework}] ${group.message}`);
      lines.push(`   Fingerprint: ${group.fingerprint}`);
      lines.push(`   Runs: ${group.runs.map((run) => `#${run.runNumber}`).join(", ")}`);
    }
    const omitted = report.failureGroups.length - DISPLAY_LIMIT;
    if (omitted > 0) lines.push(`... ${omitted} additional one-off group${omitted === 1 ? "" : "s"} omitted.`);
  }
  lines.push(
    "",
    `Unique fingerprints: ${report.uniqueFingerprints}`,
    `Recurring fingerprints: ${report.recurringFingerprints}`,
    `Unclassified runs: ${report.unclassifiedRuns.length}`,
    `Redactions: ${report.redactionCount}`
  );
  return `${lines.join("\n")}\n`;
}

export function renderHistoryMarkdown(report: HistoryReport): string {
  const lines = [
    "## FailSift failure history",
    "",
    `**Repository:** ${escapeMarkdown(report.source.repository)}  `,
    `**Workflow:** ${escapeMarkdown(report.source.workflow)}  `,
    `**Failed runs analyzed:** ${report.runsAnalyzed} (${report.actionableRuns} actionable)`,
    ""
  ];
  if (report.failureGroups.length === 0) {
    lines.push("No actionable failure fingerprints were detected.");
  } else {
    lines.push("| Occurrences | Failure | Runs |", "| ---: | --- | --- |");
    for (const group of report.failureGroups.slice(0, DISPLAY_LIMIT)) {
      lines.push(`| ${group.occurrences} (${group.sharePercent}%) | ${groupMarkdown(group)} | ${runsMarkdown(group)} |`);
    }
    const omitted = report.failureGroups.length - DISPLAY_LIMIT;
    if (omitted > 0) lines.push("", `_${omitted} additional one-off group${omitted === 1 ? "" : "s"} omitted from this view._`);
  }
  lines.push(
    "",
    `**Unique fingerprints:** ${report.uniqueFingerprints}  `,
    `**Recurring fingerprints:** ${report.recurringFingerprints}  `,
    `**Unclassified runs:** ${report.unclassifiedRuns.length}  `,
    `**Redactions:** ${report.redactionCount}`,
    "",
    "_FailSift analyzes bounded, redacted logs as untrusted text and never executes their contents._",
    ""
  );
  return lines.join("\n");
}

function groupMarkdown(group: HistoryFailureGroup): string {
  const location = group.file ? ` in ${escapeMarkdown(group.file)}` : "";
  return `**${escapeMarkdown(group.framework)} / ${escapeMarkdown(group.category)}:** ${escapeMarkdown(group.message)}${location}<br>\`${group.fingerprint}\``;
}

function runsMarkdown(group: HistoryFailureGroup): string {
  return group.runs.map((run) => safeRunLink(run.runNumber, run.runId, run.runUrl)).join(", ");
}

function safeRunLink(runNumber: number, runId: number, runUrl: string): string {
  const expectedSuffix = `/actions/runs/${runId}`;
  return runUrl.startsWith("https://github.com/") && runUrl.endsWith(expectedSuffix)
    ? `[#${runNumber}](${runUrl})`
    : `#${runNumber}`;
}
