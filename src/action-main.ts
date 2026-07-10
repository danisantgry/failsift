import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GithubClient, type GithubAnalysis } from "./github.js";
import { renderMarkdown } from "./render.js";

export interface ActionIO {
  getInput(name: string, required?: boolean): string;
  getBooleanInput(name: string): boolean;
  setOutput(name: string, value: string): void;
  setFailed(message: string): void;
  notice(message: string): void;
  writeSummary(markdown: string): Promise<void>;
}

export interface ActionGithubClient {
  analyzeRun(runId: number, limits: { maxBytes: number }): Promise<GithubAnalysis>;
  upsertComment(
    pullRequestNumber: number,
    workflowId: number,
    body: string,
    updateExisting: boolean
  ): Promise<"created" | "updated">;
}

export interface ActionEnvironment {
  GITHUB_REPOSITORY?: string;
  RUNNER_TEMP?: string;
}

export type GithubClientFactory = (repository: string, token: string) => ActionGithubClient;

export async function executeAction(
  io: ActionIO,
  environment: ActionEnvironment = process.env,
  clientFactory: GithubClientFactory = (repository, token) => new GithubClient(repository, token)
): Promise<void> {
  try {
    const token = io.getInput("github-token", true);
    const runId = positiveInteger(io.getInput("run-id", true), "run-id");
    const repository = io.getInput("repository") || environment.GITHUB_REPOSITORY || "";
    const maxLogMb = positiveNumber(io.getInput("max-log-mb") || "50", "max-log-mb");
    const shouldComment = io.getBooleanInput("comment");
    const updateComment = io.getBooleanInput("update-comment");
    const client = clientFactory(repository, token);
    const result = await client.analyzeRun(runId, { maxBytes: Math.floor(maxLogMb * 1024 * 1024) });
    const markdown = renderMarkdown(result.report);
    const reportDirectory = join(environment.RUNNER_TEMP || process.cwd(), "failsift");
    const reportPath = join(reportDirectory, `run-${runId}.md`);
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(reportPath, markdown, "utf8");
    await io.writeSummary(markdown);

    if (shouldComment && result.pullRequestNumber !== null) {
      await client.upsertComment(result.pullRequestNumber, result.run.workflow_id, markdown, updateComment);
    } else if (shouldComment) {
      io.notice("No associated pull request was found; wrote the diagnosis to the job summary only.");
    }

    io.setOutput("primary-error", result.report.primaryFailure?.message ?? "");
    io.setOutput("confidence", result.report.confidence);
    io.setOutput("fingerprint", result.report.fingerprint ?? "");
    io.setOutput("redaction-count", String(result.report.redactionCount));
    io.setOutput("report-path", reportPath);
  } catch (error) {
    io.setFailed(error instanceof Error ? error.message : String(error));
  }
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function positiveNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number.`);
  return parsed;
}
