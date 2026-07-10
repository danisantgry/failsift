import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { executeAction, type ActionIO } from "../src/action-main.js";
import { analyzeText } from "../src/analyze.js";

function setup(overrides: Record<string, string> = {}) {
  const inputs: Record<string, string> = {
    "github-token": "token",
    "run-id": "42",
    repository: "owner/repo",
    "max-log-mb": "10",
    ...overrides
  };
  const outputs = new Map<string, string>();
  const io: ActionIO = {
    getInput: (name) => inputs[name] ?? "",
    getBooleanInput: (name) => name === "comment" || name === "update-comment",
    setOutput: (name, value) => outputs.set(name, value),
    setFailed: vi.fn(),
    notice: vi.fn(),
    writeSummary: vi.fn(async () => undefined)
  };
  return { io, outputs };
}

function analysis(pullRequestNumber: number | null) {
  return {
    report: analyzeText("src/app.ts(4,2): error TS1005: ';' expected.", {
      source: { kind: "github", label: "owner/repo / CI #42" }
    }),
    run: {
      id: 42,
      workflow_id: 9,
      name: "CI",
      html_url: "https://example.test/run",
      head_sha: "abc",
      pull_requests: []
    },
    pullRequestNumber
  };
}

describe("executeAction", () => {
  it("writes a report, comments on a PR, and exposes outputs", async () => {
    const { io, outputs } = setup();
    const client = {
      analyzeRun: vi.fn(async () => analysis(7)),
      upsertComment: vi.fn(async () => "updated" as const)
    };
    const directory = join(tmpdir(), `failsift-action-${process.pid}`);
    await executeAction(io, { RUNNER_TEMP: directory }, () => client);

    expect(client.analyzeRun).toHaveBeenCalledWith(42, { maxBytes: 10 * 1024 * 1024 });
    expect(client.upsertComment).toHaveBeenCalledWith(7, 9, expect.stringContaining("Primary failure"), true);
    expect(outputs.get("confidence")).toBe("high");
    expect(outputs.get("report-path")).toContain("run-42.md");
    await expect(readFile(outputs.get("report-path")!, "utf8")).resolves.toContain("FailSift CI diagnosis");
    expect(io.setFailed).not.toHaveBeenCalled();
  });

  it("falls back to the job summary when no PR is associated", async () => {
    const { io } = setup({ repository: "" });
    const client = {
      analyzeRun: vi.fn(async () => analysis(null)),
      upsertComment: vi.fn(async () => "created" as const)
    };
    await executeAction(io, { GITHUB_REPOSITORY: "owner/repo", RUNNER_TEMP: tmpdir() }, () => client);
    expect(io.notice).toHaveBeenCalledWith(expect.stringContaining("No associated pull request"));
    expect(client.upsertComment).not.toHaveBeenCalled();
  });

  it("reports invalid numeric inputs without starting a client", async () => {
    const { io } = setup({ "run-id": "not-a-run" });
    const factory = vi.fn();
    await executeAction(io, {}, factory);
    expect(io.setFailed).toHaveBeenCalledWith("run-id must be a positive integer.");
    expect(factory).not.toHaveBeenCalled();
  });

  it("reports invalid size inputs", async () => {
    const { io } = setup({ "max-log-mb": "0" });
    await executeAction(io, {}, vi.fn());
    expect(io.setFailed).toHaveBeenCalledWith("max-log-mb must be a positive number.");
  });

  it("can disable pull request comments", async () => {
    const { io, outputs } = setup();
    io.getBooleanInput = () => false;
    const client = {
      analyzeRun: vi.fn(async () => analysis(7)),
      upsertComment: vi.fn(async () => "created" as const)
    };
    await executeAction(io, { RUNNER_TEMP: tmpdir() }, () => client);
    expect(client.upsertComment).not.toHaveBeenCalled();
    expect(io.notice).not.toHaveBeenCalled();
    expect(outputs.get("primary-error")).toContain("TS1005");
  });

  it("normalizes non-Error failures from adapters", async () => {
    const { io } = setup();
    const client = {
      analyzeRun: vi.fn(async () => { throw "adapter failed"; }),
      upsertComment: vi.fn(async () => "created" as const)
    };
    await executeAction(io, {}, () => client);
    expect(io.setFailed).toHaveBeenCalledWith("adapter failed");
  });
});
