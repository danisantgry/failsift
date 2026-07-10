import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeText } from "../src/analyze.js";
import type { Parser } from "../src/types.js";

const fixtures = join(import.meta.dirname, "fixtures");

async function analyzeFixture(name: string) {
  const text = await readFile(join(fixtures, name), "utf8");
  return analyzeText(text, { source: { kind: "file", label: name } });
}

describe("analyzeText", () => {
  it.each([
    ["typescript.log", "TypeScript", "compile", "TS2322"],
    ["vitest.log", "Vitest", "test", "expected 4 to be 5"],
    ["eslint.log", "ESLint", "lint", "never used"],
    ["npm.log", "npm", "dependency", "ERESOLVE"],
    ["pytest.log", "pytest", "test", "received 500"],
    ["generic.log", "Generic", "runtime", "migration lock"]
  ])("ranks the root cause in %s", async (file, framework, category, message) => {
    const report = await analyzeFixture(file);
    expect(report.primaryFailure).toMatchObject({ framework, category });
    expect(report.primaryFailure?.message).toContain(message);
    expect(report.fingerprint).toMatch(/^fs1-[a-f0-9]{16}$/u);
  });

  it("returns a low-confidence empty diagnosis for successful logs", async () => {
    const report = await analyzeFixture("clean.log");
    expect(report.primaryFailure).toBeNull();
    expect(report.confidence).toBe("low");
    expect(report.frameworks).toEqual([]);
  });

  it("redacts before parsing and reports noise reduction", async () => {
    const report = await analyzeFixture("typescript.log");
    expect(report.redactionCount).toBe(3);
    expect(JSON.stringify(report)).not.toContain("example-secret-value");
    expect(JSON.stringify(report)).not.toContain("build-owner@example.com");
    expect(report.secondaryFailures.filter((failure) => failure.message.includes("command failed"))).toHaveLength(1);

    const noisy = `${Array.from({ length: 200 }, (_, index) => `progress ${index}`).join("\n")}\nsrc/app.ts(2,3): error TS1005: ';' expected.`;
    const compact = analyzeText(noisy, { source: { kind: "text", label: "noise" } });
    expect(compact.reductionPercent).toBeGreaterThanOrEqual(99);
  });

  it("keeps fingerprints stable when volatile numbers change", () => {
    const first = analyzeText("Error: request 123 failed after 5000 ms", { source: { kind: "text", label: "a" } });
    const second = analyzeText("Error: request 456 failed after 9000 ms", { source: { kind: "text", label: "b" } });
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it("supports isolated custom parsers", () => {
    const parser: Parser = {
      id: "custom",
      parse: () => [{
        parser: "custom",
        framework: "Custom",
        category: "build",
        message: "custom failure",
        lineNumber: 1,
        score: 99
      }]
    };
    const report = analyzeText("anything", { source: { kind: "text", label: "custom" } }, [parser]);
    expect(report.primaryFailure?.parser).toBe("custom");
  });

  it("supports alternate compiler and pytest exception formats", () => {
    const typescript = analyzeText("src/app.ts:8:4 - error TS2345: bad argument", {
      source: { kind: "text", label: "ts" }
    });
    expect(typescript.primaryFailure).toMatchObject({ file: "src/app.ts", line: 8, column: 4 });

    const pytest = analyzeText("E   ValueError: invalid order", {
      source: { kind: "text", label: "pytest" }
    });
    expect(pytest.primaryFailure).toMatchObject({ framework: "pytest", message: "ValueError: invalid order" });
  });

  it("prioritizes timeouts over exit-code cascades", () => {
    const report = analyzeText("Job timed out after 10 minutes\nProcess completed with exit code 1.", {
      source: { kind: "text", label: "timeout" }
    });
    expect(report.primaryFailure?.category).toBe("timeout");
    expect(report.confidence).toBe("medium");
  });
});
