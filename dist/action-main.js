import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GithubClient } from "./github.js";
import { renderMarkdown } from "./render.js";
export async function executeAction(io, environment = process.env, clientFactory = (repository, token) => new GithubClient(repository, token)) {
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
        }
        else if (shouldComment) {
            io.notice("No associated pull request was found; wrote the diagnosis to the job summary only.");
        }
        io.setOutput("primary-error", result.report.primaryFailure?.message ?? "");
        io.setOutput("confidence", result.report.confidence);
        io.setOutput("fingerprint", result.report.fingerprint ?? "");
        io.setOutput("redaction-count", String(result.report.redactionCount));
        io.setOutput("report-path", reportPath);
    }
    catch (error) {
        io.setFailed(error instanceof Error ? error.message : String(error));
    }
}
function positiveInteger(value, name) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0)
        throw new Error(`${name} must be a positive integer.`);
    return parsed;
}
function positiveNumber(value, name) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0)
        throw new Error(`${name} must be a positive number.`);
    return parsed;
}
