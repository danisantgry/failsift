import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const root = join(import.meta.dirname, "..");
const cli = join(root, "dist", "cli.js");

describe("compiled CLI", () => {
  it("analyzes a fixture and emits machine-readable JSON", async () => {
    const { stdout, stderr } = await execute(process.execPath, [
      cli,
      "analyze",
      join(root, "test", "fixtures", "typescript.log"),
      "--format",
      "json"
    ], { cwd: root });
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      schemaVersion: 1,
      confidence: "high",
      primaryFailure: { framework: "TypeScript", category: "compile" }
    });
  });

  it("uses exit code 2 for invalid local input", async () => {
    try {
      await execute(process.execPath, [cli, "analyze", "missing.log"], { cwd: root });
      throw new Error("CLI unexpectedly succeeded");
    } catch (error) {
      const failure = error as Error & { code: number; stderr: string };
      expect(failure.code).toBe(2);
      expect(failure.stderr).toContain("Cannot read input file");
    }
  });
});
