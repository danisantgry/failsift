import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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

  it("initializes the GitHub Action from a detected CI workflow", async () => {
    const project = await mkdtemp(join(tmpdir(), "failsift-cli-"));
    const workflows = join(project, ".github", "workflows");
    await mkdir(workflows, { recursive: true });
    await writeFile(join(workflows, "ci.yml"), "name: CI\non: [push, pull_request]\njobs:\n  test: {}\n");
    const { stdout, stderr } = await execute(process.execPath, [cli, "init", project], { cwd: root });
    expect(stderr).toBe("");
    expect(stdout).toContain("workflow created");
    expect(stdout).toContain('Watching: "CI"');
    expect(await readFile(join(workflows, "failsift.yml"), "utf8")).toContain("danisantgry/failsift@v0");
  });

  it("rejects history requests above the safety limit before making a network call", async () => {
    try {
      await execute(process.execPath, [
        cli,
        "history",
        "--repo",
        "owner/repo",
        "--workflow",
        "ci.yml",
        "--limit",
        "26"
      ], { cwd: root });
      throw new Error("CLI unexpectedly succeeded");
    } catch (error) {
      const failure = error as Error & { code: number; stderr: string };
      expect(failure.code).toBe(2);
      expect(failure.stderr).toContain("history limit must be an integer from 1 to 25");
    }
  });

  it("explains GitHub log authentication before making a network call", async () => {
    const environment = { ...process.env };
    delete environment.GH_TOKEN;
    delete environment.GITHUB_TOKEN;
    try {
      await execute(process.execPath, [
        cli,
        "history",
        "--repo",
        "owner/repo",
        "--workflow",
        "ci.yml"
      ], { cwd: root, env: environment });
      throw new Error("CLI unexpectedly succeeded");
    } catch (error) {
      const failure = error as Error & { code: number; stderr: string };
      expect(failure.code).toBe(3);
      expect(failure.stderr).toContain("requires GH_TOKEN or GITHUB_TOKEN");
    }
  });
});
