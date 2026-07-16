import { describe, expect, it } from "vitest";
import { analyzeText } from "../src/analyze.js";
import { escapeMarkdown, renderMarkdown, renderReport, renderTerminal } from "../src/render.js";

const report = analyzeText("Error: build <script>alert(1)</script> | `unsafe`", {
  source: { kind: "text", label: "malicious <source>" }
});

describe("renderers", () => {
  it("renders a readable terminal report", () => {
    const output = renderTerminal(report);
    expect(output).toContain("FailSift report");
    expect(output).toContain("Primary: [Generic]");
    expect(output).toContain("Fingerprint: fs1-");
  });

  it("escapes untrusted Markdown and HTML", () => {
    const output = renderMarkdown(report);
    expect(output).not.toContain("<script>");
    expect(output).toContain("&lt;script&gt;");
    expect(output).toContain("&#124;");
    expect(output).toContain("&#96;unsafe&#96;");
  });

  it("renders versioned JSON with a trailing newline", () => {
    const output = renderReport(report, "json");
    expect(output.endsWith("\n")).toBe(true);
    expect(JSON.parse(output)).toMatchObject({ schemaVersion: 1, confidence: "medium" });
  });

  it("selects terminal and Markdown through the generic renderer", () => {
    expect(renderReport(report, "terminal")).toContain("FailSift report");
    expect(renderReport(report, "markdown")).toContain("## FailSift CI diagnosis");
  });

  it("renders source locations with line and column details", () => {
    const located = analyzeText("src/app.ts(8,4): error TS2345: bad argument", {
      source: { kind: "text", label: "located" }
    });
    expect(renderTerminal(located)).toContain("src/app.ts:8:4");
    expect(renderMarkdown(located)).toContain("src/app.ts:8:4");
  });

  it("renders an empty report", () => {
    const empty = analyzeText("all good", { source: { kind: "text", label: "clean" } });
    expect(renderMarkdown(empty)).toContain("No actionable failure");
    expect(renderTerminal(empty)).toContain("No actionable failure");
  });

  it("escapes multiline values", () => {
    expect(escapeMarkdown("a\nb|c`d<e>")).toBe("a b&#124;c&#96;d&lt;e&gt;");
  });

  it("neutralizes repeated Markdown control characters and backslashes", () => {
    const escaped = escapeMarkdown("[x](javascript:alert(1)) \\|\\| **bold** # heading");
    for (const character of ["\\", "`", "*", "_", "[", "]", "{", "}", "(", ")", "!", "|"]) {
      expect(escaped).not.toContain(character);
    }
    expect(escaped).toContain("&#92;");
    expect(escaped).toContain("&#124;&#92;&#124;");
  });
});
