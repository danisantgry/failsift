import { describe, expect, it } from "vitest";
import { analyzeText } from "../src/analyze.js";
import { buildHistoryReport } from "../src/history.js";
import { renderHistoryMarkdown, renderHistoryReport, renderHistoryTerminal } from "../src/history-render.js";

function analysis(runNumber: number, text: string, runUrl?: string) {
  return {
    report: analyzeText(text, { source: { kind: "text" as const, label: `run-${runNumber}` } }),
    run: {
      runId: 1000 + runNumber,
      runNumber,
      runUrl: runUrl ?? `https://github.com/owner/repo/actions/runs/${1000 + runNumber}`,
      createdAt: `2026-07-${String(runNumber).padStart(2, "0")}T12:00:00Z`
    }
  };
}

describe("failure history", () => {
  it("groups stable fingerprints and ranks recurring failures first", () => {
    const report = buildHistoryReport("owner/repo", "ci.yml", [
      analysis(4, "Error: request 456 failed after 9000 ms"),
      analysis(3, "src/app.ts(4,2): error TS1005: ';' expected."),
      analysis(2, "Error: request 123 failed after 5000 ms"),
      analysis(1, "build completed successfully")
    ]);
    expect(report).toMatchObject({
      schemaVersion: 1,
      runsAnalyzed: 4,
      actionableRuns: 3,
      uniqueFingerprints: 2,
      recurringFingerprints: 1
    });
    expect(report.failureGroups[0]).toMatchObject({ occurrences: 2, sharePercent: 67, framework: "Generic" });
    expect(report.failureGroups[0]?.runs.map((run) => run.runNumber)).toEqual([4, 2]);
    expect(report.unclassifiedRuns[0]?.runNumber).toBe(1);
  });

  it("renders terminal, Markdown, and versioned JSON reports", () => {
    const report = buildHistoryReport("owner/repo", "ci.yml", [
      analysis(2, "Error: repeated failure"),
      analysis(1, "Error: repeated failure")
    ]);
    expect(renderHistoryTerminal(report)).toContain("Recurring failure groups");
    expect(renderHistoryTerminal(report)).toContain("2x / 100%");
    expect(renderHistoryMarkdown(report)).toContain("| 2 (100%) |");
    expect(renderHistoryMarkdown(report)).toContain("[#2](https://github.com/owner/repo/actions/runs/1002)");
    expect(renderHistoryReport(report, "terminal")).toContain("FailSift failure history");
    expect(renderHistoryReport(report, "markdown")).toContain("## FailSift failure history");
    expect(JSON.parse(renderHistoryReport(report, "json"))).toMatchObject({ schemaVersion: 1, runsAnalyzed: 2 });
  });

  it("escapes untrusted history values and refuses arbitrary run links", () => {
    const report = buildHistoryReport("owner/<script>", "ci|unsafe.yml", [
      analysis(1, "Error: <script>alert(1)</script> | unsafe", "javascript:alert(1)")
    ]);
    const markdown = renderHistoryMarkdown(report);
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain("javascript:");
    expect(markdown).toContain("&lt;script&gt;");
    expect(markdown).toContain("#1");
  });

  it("renders an empty history without division errors", () => {
    const report = buildHistoryReport("owner/repo", "ci.yml", []);
    expect(report.failureGroups).toEqual([]);
    expect(report.recurringFingerprints).toBe(0);
    expect(renderHistoryTerminal(report)).toContain("No actionable failure fingerprints");
    expect(renderHistoryMarkdown(report)).toContain("No actionable failure fingerprints");
  });

  it("keeps long one-off histories compact and includes source files", () => {
    const labels = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet"];
    const analyses = labels.map((label, index) => analysis(index + 1, `Error: failure ${label}`));
    analyses.push(analysis(11, "src/app.ts(8,4): error TS2345: bad argument"));
    const report = buildHistoryReport("owner/repo", "ci.yml", analyses);
    const terminal = renderHistoryTerminal(report);
    const markdown = renderHistoryMarkdown(report);
    expect(terminal).toContain("Failure groups:");
    expect(terminal).toContain("1 additional one-off group omitted");
    expect(markdown).toContain("1 additional one-off group omitted");
    expect(markdown).toContain("in src/app.ts");
  });
});
