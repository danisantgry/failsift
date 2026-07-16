import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { InputError } from "./errors.js";
const DEFAULT_OUTPUT = ".github/workflows/failsift.yml";
export async function initialize(options = {}) {
    const root = resolve(options.directory ?? ".");
    const outputPath = resolveOutput(root, options.output ?? DEFAULT_OUTPUT);
    const workflows = normalizeWorkflowNames(options.workflows?.length ? options.workflows : await discoverWorkflows(root, outputPath));
    if (workflows.length === 0) {
        throw new InputError("No CI workflow was detected. Pass its exact name with --workflow, for example: failsift init --workflow CI");
    }
    const content = createWorkflow(workflows);
    const existing = await readOptional(outputPath);
    if (options.dryRun) {
        return { content, outputPath, status: "preview", workflows };
    }
    if (existing === content) {
        return { content, outputPath, status: "unchanged", workflows };
    }
    if (existing !== undefined && !options.force) {
        throw new InputError(`${relative(root, outputPath)} already exists and differs. Review it or rerun with --force to replace it.`);
    }
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, "utf8");
    return {
        content,
        outputPath,
        status: existing === undefined ? "created" : "updated",
        workflows
    };
}
export function createWorkflow(workflows) {
    const document = {
        name: "FailSift",
        on: {
            workflow_run: {
                workflows,
                types: ["completed"]
            }
        },
        permissions: {
            actions: "read",
            contents: "read",
            "pull-requests": "write"
        },
        jobs: {
            diagnose: {
                if: "github.event.workflow_run.conclusion == 'failure'",
                "runs-on": "ubuntu-latest",
                steps: [{
                        uses: "danisantgry/failsift@v0",
                        with: {
                            "github-token": "${{ secrets.GITHUB_TOKEN }}",
                            "run-id": "${{ github.event.workflow_run.id }}"
                        }
                    }]
            }
        }
    };
    return stringify(document, { lineWidth: 0 });
}
async function discoverWorkflows(root, outputPath) {
    const workflowDirectory = resolve(root, ".github/workflows");
    let entries;
    try {
        entries = await readdir(workflowDirectory, { withFileTypes: true });
    }
    catch (error) {
        throw new InputError(`Cannot read ${relative(root, workflowDirectory)}. Is this a GitHub repository?`, {
            cause: error
        });
    }
    const candidates = [];
    for (const entry of entries) {
        if (!entry.isFile() || ![".yml", ".yaml"].includes(extname(entry.name).toLowerCase()))
            continue;
        const path = resolve(workflowDirectory, entry.name);
        if (path === outputPath)
            continue;
        const candidate = await readCandidate(path);
        if (candidate)
            candidates.push(candidate);
    }
    candidates.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
    return candidates[0] ? [candidates[0].name] : [];
}
async function readCandidate(path) {
    let document;
    try {
        document = parse(await readFile(path, "utf8"));
    }
    catch {
        return undefined;
    }
    if (!isRecord(document) || typeof document.name !== "string" || !isRecord(document.jobs))
        return undefined;
    if (hasEvent(document.on, "workflow_run"))
        return undefined;
    const name = document.name.trim();
    if (!name || /failsift/iu.test(name))
        return undefined;
    let score = 0;
    if (/^(ci|test|tests|build|checks?)$/iu.test(name))
        score += 100;
    if (hasEvent(document.on, "pull_request"))
        score += 40;
    if (hasEvent(document.on, "push"))
        score += 20;
    if (/codeql|security|release|deploy|publish|dependabot/iu.test(name))
        score -= 100;
    return score > 0 ? { name, score } : undefined;
}
function resolveOutput(root, output) {
    const outputPath = resolve(root, output);
    const fromRoot = relative(root, outputPath);
    if (isAbsolute(fromRoot) || fromRoot === ".." || fromRoot.startsWith(`..\\`) || fromRoot.startsWith("../")) {
        throw new InputError("The generated workflow must stay inside the target repository.");
    }
    return outputPath;
}
function normalizeWorkflowNames(names) {
    return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}
async function readOptional(path) {
    try {
        await access(path);
        return await readFile(path, "utf8");
    }
    catch (error) {
        const code = error.code;
        if (code === "ENOENT")
            return undefined;
        throw new InputError(`Cannot read existing workflow at ${path}.`, { cause: error });
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasEvent(value, event) {
    if (typeof value === "string")
        return value === event;
    if (Array.isArray(value))
        return value.includes(event);
    return isRecord(value) && Object.hasOwn(value, event);
}
