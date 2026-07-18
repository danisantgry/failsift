import { describe, expect, it, vi } from "vitest";
import { NetworkError } from "../src/errors.js";
import { GithubClient } from "../src/github.js";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function mockGithub(options: { directPull?: boolean; noPull?: boolean; noFailedJobs?: boolean; noExistingComment?: boolean } = {}) {
  const requests: Array<{ url: string; method: string; body?: string }> = [];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
    if (url.includes("/actions/workflows/ci.yml/runs")) return json({
      workflow_runs: [
        {
          id: 42,
          workflow_id: 9,
          name: "CI",
          html_url: "https://github.com/owner/repo/actions/runs/42",
          head_sha: "abc123",
          run_number: 12,
          created_at: "2026-07-18T12:00:00Z",
          pull_requests: []
        },
        {
          id: 43,
          workflow_id: 9,
          name: "CI",
          html_url: "https://github.com/owner/repo/actions/runs/43",
          head_sha: "def456",
          run_number: 11,
          created_at: "2026-07-17T12:00:00Z",
          pull_requests: []
        }
      ]
    });
    if (url.endsWith("/actions/runs/42")) return json({
      id: 42,
      workflow_id: 9,
      name: "CI",
      html_url: "https://github.com/owner/repo/actions/runs/42",
      head_sha: "abc123",
      run_number: 12,
      created_at: "2026-07-18T12:00:00Z",
      pull_requests: options.directPull ? [{ number: 7 }] : []
    });
    if (url.includes("/actions/runs/42/jobs")) return json({
      total_count: 2,
      jobs: [
        { id: 10, name: "test", conclusion: options.noFailedJobs ? "success" : "failure", html_url: "https://example.test/test" },
        { id: 11, name: "lint", conclusion: "success", html_url: "https://example.test/lint" }
      ]
    });
    if (url.includes("/actions/runs/43/jobs")) return json({
      total_count: 1,
      jobs: [{ id: 12, name: "test", conclusion: "failure", html_url: "https://example.test/test-43" }]
    });
    if (url.endsWith("/actions/jobs/10/logs")) return new Response("src/app.ts(4,2): error TS1005: ';' expected.");
    if (url.endsWith("/actions/jobs/12/logs")) return new Response("src/app.ts(9,2): error TS1005: ';' expected.");
    if (url.includes("/commits/abc123/pulls")) return json(options.noPull ? [] : [{ number: 8 }]);
    if (url.includes("/issues/8/comments") && method === "GET") return json(options.noExistingComment ? [] : [{ id: 100, body: "<!-- failsift:workflow:9 -->\nold" }]);
    if (url.endsWith("/issues/comments/100") && method === "PATCH") return json({ id: 100 });
    if (/\/issues\/(?:7|8)\/comments/u.test(url) && method === "POST") return json({ id: 101 }, 201);
    return json({ message: "not found" }, 404);
  }) as unknown as typeof fetch;
  return { fetcher, requests };
}

describe("GithubClient", () => {
  it("downloads only failed jobs and resolves a PR from the commit", async () => {
    const mock = mockGithub();
    const client = new GithubClient("owner/repo", "token", mock.fetcher);
    const result = await client.analyzeRun(42);
    expect(result.pullRequestNumber).toBe(8);
    expect(result.report.primaryFailure?.framework).toBe("TypeScript");
    expect(result.report.source.jobs).toEqual(["test"]);
    expect(mock.requests.some((request) => request.url.includes("jobs/11/logs"))).toBe(false);
  });

  it("uses a direct PR and creates a comment", async () => {
    const mock = mockGithub({ directPull: true });
    const client = new GithubClient("owner/repo", undefined, mock.fetcher);
    const result = await client.analyzeRun(42);
    expect(result.pullRequestNumber).toBe(7);
    await expect(client.upsertComment(7, 9, "report", false)).resolves.toBe("created");
    expect(mock.requests.at(-1)).toMatchObject({ method: "POST" });
  });

  it("updates an idempotent workflow comment", async () => {
    const mock = mockGithub();
    const client = new GithubClient("owner/repo", "token", mock.fetcher);
    await expect(client.upsertComment(8, 9, "new report", true)).resolves.toBe("updated");
    expect(mock.requests.at(-1)).toMatchObject({ method: "PATCH" });
  });

  it("creates a comment when no marker exists", async () => {
    const mock = mockGithub({ noExistingComment: true });
    const client = new GithubClient("owner/repo", "token", mock.fetcher);
    await expect(client.upsertComment(8, 9, "new report", true)).resolves.toBe("created");
  });

  it("handles completed runs without failed jobs or pull requests", async () => {
    const mock = mockGithub({ noFailedJobs: true, noPull: true });
    const client = new GithubClient("owner/repo", "token", mock.fetcher);
    const result = await client.analyzeRun(42);
    expect(result.pullRequestNumber).toBeNull();
    expect(result.report.primaryFailure).toBeNull();
    expect(result.report.source.jobs).toEqual([]);
  });

  it("groups recurring failures across recent workflow runs", async () => {
    const mock = mockGithub();
    const client = new GithubClient("owner/repo", "token", mock.fetcher);
    const report = await client.analyzeHistory("ci.yml", 2);
    expect(report).toMatchObject({
      runsAnalyzed: 2,
      actionableRuns: 2,
      uniqueFingerprints: 1,
      recurringFingerprints: 1
    });
    expect(report.failureGroups[0]).toMatchObject({ occurrences: 2, framework: "TypeScript" });
    expect(mock.requests.some((request) => request.url.includes("/commits/"))).toBe(false);
  });

  it("validates workflow history identifiers and bounds", async () => {
    const mock = mockGithub();
    const client = new GithubClient("owner/repo", "token", mock.fetcher);
    await expect(client.analyzeHistory("../ci.yml", 2)).rejects.toThrow(/Workflow must/u);
    await expect(client.analyzeHistory("ci.yml", 26)).rejects.toThrow(/1 to 25/u);
  });

  it("reports invalid repositories and API failures", async () => {
    expect(() => new GithubClient("invalid")).toThrow(NetworkError);
    const fetcher = vi.fn(async () => json({ message: "denied" }, 403)) as unknown as typeof fetch;
    const client = new GithubClient("owner/repo", "token", fetcher);
    await expect(client.analyzeRun(42)).rejects.toThrow(/GitHub returned 403/u);
  });

  it("wraps transport errors", async () => {
    const fetcher = vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const client = new GithubClient("owner/repo", "token", fetcher);
    await expect(client.analyzeRun(42)).rejects.toThrow(/request failed/u);
  });
});
