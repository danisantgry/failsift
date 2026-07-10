import { type GithubAnalysis } from "./github.js";
export interface ActionIO {
    getInput(name: string, required?: boolean): string;
    getBooleanInput(name: string): boolean;
    setOutput(name: string, value: string): void;
    setFailed(message: string): void;
    notice(message: string): void;
    writeSummary(markdown: string): Promise<void>;
}
export interface ActionGithubClient {
    analyzeRun(runId: number, limits: {
        maxBytes: number;
    }): Promise<GithubAnalysis>;
    upsertComment(pullRequestNumber: number, workflowId: number, body: string, updateExisting: boolean): Promise<"created" | "updated">;
}
export interface ActionEnvironment {
    GITHUB_REPOSITORY?: string;
    RUNNER_TEMP?: string;
}
export type GithubClientFactory = (repository: string, token: string) => ActionGithubClient;
export declare function executeAction(io: ActionIO, environment?: ActionEnvironment, clientFactory?: GithubClientFactory): Promise<void>;
