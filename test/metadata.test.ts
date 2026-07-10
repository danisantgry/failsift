import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = join(import.meta.dirname, "..");

describe("distribution contracts", () => {
  it("declares a Node 24 JavaScript Action with the documented inputs", async () => {
    const action = parse(await readFile(join(root, "action.yml"), "utf8"));
    expect(action.runs).toEqual({ using: "node24", main: "dist/action.cjs" });
    expect(Object.keys(action.inputs)).toEqual(expect.arrayContaining([
      "github-token",
      "run-id",
      "repository",
      "comment",
      "update-comment",
      "max-log-mb"
    ]));
    expect(Object.keys(action.outputs)).toEqual(expect.arrayContaining([
      "primary-error",
      "confidence",
      "fingerprint",
      "redaction-count",
      "report-path"
    ]));
  });

  it("keeps every committed workflow valid YAML", async () => {
    const workflows = ["ci.yml", "codeql.yml", "demo-failure.yml", "failsift.yml", "publish-npm.yml"];
    for (const workflow of workflows) {
      const document = parse(await readFile(join(root, ".github", "workflows", workflow), "utf8"));
      expect(document).toHaveProperty("name");
      expect(document).toHaveProperty("on");
      expect(document).toHaveProperty("jobs");
    }
  });

  it("ships the CLI and bundled Action in the package contract", async () => {
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(manifest).toMatchObject({ name: "failsift", version: "0.1.0", license: "MIT" });
    expect(manifest.bin).toEqual({ failsift: "dist/cli.js" });
    expect(manifest.files).toEqual(expect.arrayContaining(["dist", "action.yml", "PRIVACY.md", "SECURITY.md"]));
    expect((await stat(join(root, "dist", "action.cjs"))).size).toBeGreaterThan(10_000);
  });
});
