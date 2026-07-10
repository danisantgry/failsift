import type { AnalysisReport, InputLimits } from "./types.js";
type FetchLike = typeof fetch;
interface WorkflowRun {
    id: number;
    workflow_id: number;
    name: string;
    html_url: string;
    head_sha: string;
    pull_requests: Array<{
        number: number;
    }>;
}
export interface GithubAnalysis {
    report: AnalysisReport;
    run: WorkflowRun;
    pullRequestNumber: number | null;
}
export declare class GithubClient {
    private readonly repository;
    private readonly token?;
    private readonly fetcher;
    constructor(repository: string, token?: string | undefined, fetcher?: FetchLike);
    analyzeRun(runId: number, limits?: Partial<InputLimits>): Promise<GithubAnalysis>;
    upsertComment(pullRequestNumber: number, workflowId: number, body: string, updateExisting: boolean): Promise<"created" | "updated">;
    private listJobs;
    private resolvePullRequest;
    private requestText;
    private requestJson;
    private request;
}
export {};
