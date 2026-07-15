import { Readable } from "node:stream";
import { analyzeText } from "./analyze.js";
import { NetworkError } from "./errors.js";
import { readStreamLimited, resolveLimits } from "./input.js";
import type { AnalysisReport, InputLimits } from "./types.js";
import { VERSION } from "./version.js";

type FetchLike = typeof fetch;

interface WorkflowRun {
  id: number;
  workflow_id: number;
  name: string;
  html_url: string;
  head_sha: string;
  pull_requests: Array<{ number: number }>;
}

interface WorkflowJob {
  id: number;
  name: string;
  conclusion: string | null;
  html_url: string;
}

interface IssueComment {
  id: number;
  body: string | null;
}

export interface GithubAnalysis {
  report: AnalysisReport;
  run: WorkflowRun;
  pullRequestNumber: number | null;
}

export class GithubClient {
  constructor(
    private readonly repository: string,
    private readonly token?: string,
    private readonly fetcher: FetchLike = fetch
  ) {
    if (!/^[^/\s]+\/[^/\s]+$/u.test(repository)) {
      throw new NetworkError("Repository must use the owner/name format.");
    }
  }

  async analyzeRun(runId: number, limits: Partial<InputLimits> = {}): Promise<GithubAnalysis> {
    const resolvedLimits = resolveLimits(limits);
    const run = await this.requestJson<WorkflowRun>(`/actions/runs/${runId}`);
    const jobs = await this.listJobs(runId);
    const failedJobs = jobs.filter((job) => ["failure", "timed_out", "cancelled", "startup_failure"].includes(job.conclusion ?? ""));
    const parts: string[] = [];
    for (const job of failedJobs) {
      const existing = parts.join("\n");
      const prefix = `===== FailSift job: ${job.name} =====\n`;
      const remainingBytes = resolvedLimits.maxBytes - Buffer.byteLength(existing) - Buffer.byteLength(prefix) - 1;
      const existingLines = existing.length === 0 ? 0 : existing.split(/\r?\n/u).length;
      const remainingLines = resolvedLimits.maxLines - existingLines - 1;
      const log = await this.requestText(`/actions/jobs/${job.id}/logs`, {
        maxBytes: Math.max(1, remainingBytes),
        maxLines: Math.max(1, remainingLines)
      });
      parts.push(`${prefix}${log}`);
    }
    const text = parts.join("\n");
    const report = analyzeText(text, {
      source: {
        kind: "github",
        label: `${this.repository} / ${run.name} #${runId}`,
        repository: this.repository,
        runId,
        jobs: failedJobs.map((job) => job.name),
        runUrl: run.html_url,
        workflowId: run.workflow_id
      },
      limits: resolvedLimits
    });
    return {
      report,
      run,
      pullRequestNumber: await this.resolvePullRequest(run)
    };
  }

  async upsertComment(
    pullRequestNumber: number,
    workflowId: number,
    body: string,
    updateExisting: boolean
  ): Promise<"created" | "updated"> {
    const marker = `<!-- failsift:workflow:${workflowId} -->`;
    const markedBody = `${marker}\n${body}`;
    if (updateExisting) {
      const comments = await this.requestJson<IssueComment[]>(`/issues/${pullRequestNumber}/comments?per_page=100`);
      const existing = comments.find((comment) => comment.body?.includes(marker));
      if (existing) {
        await this.requestJson(`/issues/comments/${existing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ body: markedBody })
        });
        return "updated";
      }
    }
    await this.requestJson(`/issues/${pullRequestNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: markedBody })
    });
    return "created";
  }

  private async listJobs(runId: number): Promise<WorkflowJob[]> {
    const jobs: WorkflowJob[] = [];
    let page = 1;
    let total = 1;
    while (jobs.length < total) {
      const response = await this.requestJson<{ total_count: number; jobs: WorkflowJob[] }>(
        `/actions/runs/${runId}/jobs?filter=latest&per_page=100&page=${page}`
      );
      total = response.total_count;
      jobs.push(...response.jobs);
      page += 1;
      if (response.jobs.length === 0) break;
    }
    return jobs;
  }

  private async resolvePullRequest(run: WorkflowRun): Promise<number | null> {
    const direct = run.pull_requests[0]?.number;
    if (direct !== undefined) return direct;
    const pulls = await this.requestJson<Array<{ number: number }>>(`/commits/${run.head_sha}/pulls?per_page=1`);
    return pulls[0]?.number ?? null;
  }

  private async requestText(path: string, limits: InputLimits): Promise<string> {
    const response = await this.request(path);
    if (!response.body) return "";
    return readStreamLimited(Readable.from(response.body as unknown as AsyncIterable<Uint8Array>), limits);
  }

  private async requestJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(path, init);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2026-03-10");
    headers.set("User-Agent", `failsift/${VERSION}`);
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    let response: Response;
    try {
      response = await this.fetcher(`https://api.github.com/repos/${this.repository}${path}`, { ...init, headers });
    } catch (error) {
      throw new NetworkError(`GitHub request failed for ${path}.`, { cause: error });
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300).replace(/\s+/gu, " ").trim();
      throw new NetworkError(`GitHub returned ${response.status} for ${path}${detail ? `: ${detail}` : ""}`);
    }
    return response;
  }
}
