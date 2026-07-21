import { describe, expect, it } from "vitest";
import { analyzeText } from "../src/analyze.js";
import { createDemoLog } from "../src/demo.js";

describe("built-in demo", () => {
  it("reproduces a large, secret-safe Rust diagnosis", () => {
    const log = createDemoLog();
    const report = analyzeText(log, {
      source: { kind: "text", label: "built-in Rust CI demo" }
    });

    expect(log.split("\n")).toHaveLength(8_247);
    expect(report.primaryFailure).toMatchObject({
      framework: "Rust",
      category: "compile",
      message: "E0308: mismatched types",
      file: "src/config.rs",
      line: 18,
      column: 9
    });
    expect(report.redactionCount).toBe(3);
    expect(report.reductionPercent).toBe(99);
    expect(JSON.stringify(report)).not.toContain("ci-owner@example.invalid");
    expect(JSON.stringify(report)).not.toContain("demo-value-not-a-secret");
  });
});
