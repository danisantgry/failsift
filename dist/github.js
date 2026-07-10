import { Readable } from "node:stream";
import { analyzeText } from "./analyze.js";
import { NetworkError } from "./errors.js";
import { readStreamLimited, resolveLimits } from "./input.js";
export class GithubClient {
    repository;
    token;
    fetcher;
    constructor(repository, token, fetcher = fetch) {
        this.repository = repository;
        this.token = token;
        this.fetcher = fetcher;
        if (!/^[^/\s]+\/[^/\s]+$/u.test(repository)) {
            throw new NetworkError("Repository must use the owner/name format.");
        }
    }
    async analyzeRun(runId, limits = {}) {
        const resolvedLimits = resolveLimits(limits);
        const run = await this.requestJson(`/actions/runs/${runId}`);
        const jobs = await this.listJobs(runId);
        const failedJobs = jobs.filter((job) => ["failure", "timed_out", "cancelled", "startup_failure"].includes(job.conclusion ?? ""));
        const parts = [];
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
    async upsertComment(pullRequestNumber, workflowId, body, updateExisting) {
        const marker = `<!-- failsift:workflow:${workflowId} -->`;
        const markedBody = `${marker}\n${body}`;
        if (updateExisting) {
            const comments = await this.requestJson(`/issues/${pullRequestNumber}/comments?per_page=100`);
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
    async listJobs(runId) {
        const jobs = [];
        let page = 1;
        let total = 1;
        while (jobs.length < total) {
            const response = await this.requestJson(`/actions/runs/${runId}/jobs?filter=latest&per_page=100&page=${page}`);
            total = response.total_count;
            jobs.push(...response.jobs);
            page += 1;
            if (response.jobs.length === 0)
                break;
        }
        return jobs;
    }
    async resolvePullRequest(run) {
        const direct = run.pull_requests[0]?.number;
        if (direct !== undefined)
            return direct;
        const pulls = await this.requestJson(`/commits/${run.head_sha}/pulls?per_page=1`);
        return pulls[0]?.number ?? null;
    }
    async requestText(path, limits) {
        const response = await this.request(path);
        if (!response.body)
            return "";
        return readStreamLimited(Readable.from(response.body), limits);
    }
    async requestJson(path, init = {}) {
        const response = await this.request(path, init);
        if (response.status === 204)
            return undefined;
        return response.json();
    }
    async request(path, init = {}) {
        const headers = new Headers(init.headers);
        headers.set("Accept", "application/vnd.github+json");
        headers.set("X-GitHub-Api-Version", "2026-03-10");
        headers.set("User-Agent", "failsift/0.1.0");
        if (this.token)
            headers.set("Authorization", `Bearer ${this.token}`);
        let response;
        try {
            response = await this.fetcher(`https://api.github.com/repos/${this.repository}${path}`, { ...init, headers });
        }
        catch (error) {
            throw new NetworkError(`GitHub request failed for ${path}.`, { cause: error });
        }
        if (!response.ok) {
            const detail = (await response.text()).slice(0, 300).replace(/\s+/gu, " ").trim();
            throw new NetworkError(`GitHub returned ${response.status} for ${path}${detail ? `: ${detail}` : ""}`);
        }
        return response;
    }
}
