import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { createWorkflow, initialize } from "../src/init.js";

async function repository(workflows: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "failsift-init-"));
  const directory = join(root, ".github", "workflows");
  await mkdir(directory, { recursive: true });
  await Promise.all(Object.entries(workflows).map(([name, content]) => writeFile(join(directory, name), content)));
  return root;
}

describe("workflow initializer", () => {
  it("generates valid least-privilege workflow YAML", () => {
    const content = createWorkflow(["CI", "Tests"]);
    const document = parse(content);
    expect(document.on.workflow_run).toEqual({ workflows: ["CI", "Tests"], types: ["completed"] });
    expect(document.permissions).toEqual({
      actions: "read",
      contents: "read",
      "pull-requests": "write"
    });
    expect(document.jobs.diagnose.steps[0]).toMatchObject({
      uses: "danisantgry/failsift@v0",
      with: {
        "github-token": "${{ secrets.GITHUB_TOKEN }}",
        "run-id": "${{ github.event.workflow_run.id }}"
      }
    });
  });

  it("detects the primary CI workflow and writes the integration", async () => {
    const root = await repository({
      "codeql.yml": "name: CodeQL\non: [push, pull_request]\njobs:\n  scan: {}\n",
      "ci.yml": "name: CI\non: [push, pull_request]\njobs:\n  test: {}\n"
    });
    const result = await initialize({ directory: root });
    expect(result.status).toBe("created");
    expect(result.workflows).toEqual(["CI"]);
    expect(await readFile(join(root, ".github", "workflows", "failsift.yml"), "utf8")).toBe(result.content);
  });

  it("supports repeated explicit workflows and dry runs without writing", async () => {
    const root = await repository({});
    const result = await initialize({
      directory: root,
      workflows: ["CI", "Tests", "CI"],
      dryRun: true
    });
    expect(result.status).toBe("preview");
    expect(result.workflows).toEqual(["CI", "Tests"]);
    await expect(readFile(result.outputPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not overwrite a different workflow unless forced", async () => {
    const root = await repository({ "failsift.yml": "name: Custom\n" });
    await expect(initialize({ directory: root, workflows: ["CI"] })).rejects.toThrow("already exists");
    const preview = await initialize({ directory: root, workflows: ["CI"], dryRun: true });
    expect(preview.status).toBe("preview");
    expect(await readFile(preview.outputPath, "utf8")).toBe("name: Custom\n");
    const result = await initialize({ directory: root, workflows: ["CI"], force: true });
    expect(result.status).toBe("updated");
  });

  it("reports an unchanged integration without rewriting it", async () => {
    const root = await repository({ "failsift.yml": createWorkflow(["CI"]) });
    const result = await initialize({ directory: root, workflows: ["CI"] });
    expect(result.status).toBe("unchanged");
  });

  it("rejects output paths outside the repository", async () => {
    const root = await repository({});
    await expect(initialize({ directory: root, workflows: ["CI"], output: "../failsift.yml" }))
      .rejects.toThrow("inside the target repository");
  });

  it("explains when no suitable CI workflow is available", async () => {
    const root = await repository({
      "release.yml": "name: Release\non:\n  workflow_dispatch:\njobs:\n  publish: {}\n"
    });
    await expect(initialize({ directory: root })).rejects.toThrow("No CI workflow was detected");
  });

  it("explains when the workflow directory cannot be read", async () => {
    const root = await mkdtemp(join(tmpdir(), "failsift-empty-"));
    await expect(initialize({ directory: root })).rejects.toThrow("Is this a GitHub repository");
  });
});
