export interface InitOptions {
    directory?: string;
    workflows?: string[];
    output?: string;
    dryRun?: boolean;
    force?: boolean;
}
export interface InitResult {
    content: string;
    outputPath: string;
    status: "created" | "updated" | "unchanged" | "preview";
    workflows: string[];
}
export declare function initialize(options?: InitOptions): Promise<InitResult>;
export declare function createWorkflow(workflows: string[]): string;
