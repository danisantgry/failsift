#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { analyzeText } from "./analyze.js";
import { FailSiftError, InputError } from "./errors.js";
import { GithubClient } from "./github.js";
import { renderHistoryReport } from "./history-render.js";
import { initialize } from "./init.js";
import { readInput, resolveLimits } from "./input.js";
import { renderReport } from "./render.js";
import type { OutputFormat } from "./types.js";
import { VERSION } from "./version.js";

interface CommonOptions {
  format: OutputFormat;
  output?: string;
  maxLogMb: number;
}

export async function main(argv = process.argv): Promise<number> {
  const program = new Command();
  program
    .name("failsift")
    .description("Turn noisy CI logs into concise, secret-safe failure reports.")
    .version(VERSION)
    .showHelpAfterError()
    .exitOverride();

  program.command("analyze")
    .description("Analyze a local log file or stdin.")
    .argument("<file>", "Log file path, or - for stdin")
    .option("-f, --format <format>", "terminal, markdown, or json", parseFormat, "terminal")
    .option("-o, --output <path>", "Write the report to a file")
    .option("--max-log-mb <number>", "Maximum input size in MB", parsePositive, 50)
    .action(async (file: string, options: CommonOptions) => {
      const limits = resolveLimits({ maxBytes: Math.floor(options.maxLogMb * 1024 * 1024) });
      const text = await readInput(file, limits);
      const report = analyzeText(text, {
        source: { kind: file === "-" ? "stdin" : "file", label: file === "-" ? "stdin" : basename(file) },
        limits
      });
      await emit(renderReport(report, options.format), options.output);
    });

  program.command("github")
    .description("Analyze failed jobs from a completed GitHub Actions run.")
    .requiredOption("--repo <owner/repo>", "GitHub repository")
    .requiredOption("--run <id>", "Workflow run ID", parseInteger)
    .option("-f, --format <format>", "terminal, markdown, or json", parseFormat, "terminal")
    .option("-o, --output <path>", "Write the report to a file")
    .option("--max-log-mb <number>", "Maximum combined log size in MB", parsePositive, 50)
    .action(async (options: CommonOptions & { repo: string; run: number }) => {
      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      const client = new GithubClient(options.repo, token);
      const result = await client.analyzeRun(options.run, { maxBytes: Math.floor(options.maxLogMb * 1024 * 1024) });
      await emit(renderReport(result.report, options.format), options.output);
    });

  program.command("history")
    .description("Group recurring failures across recent failed GitHub Actions runs.")
    .requiredOption("--repo <owner/repo>", "GitHub repository")
    .requiredOption("--workflow <file-or-id>", "Workflow file name or numeric ID")
    .option("--limit <number>", "Failed runs to analyze, from 1 to 25", parseHistoryLimit, 10)
    .option("-f, --format <format>", "terminal, markdown, or json", parseFormat, "terminal")
    .option("-o, --output <path>", "Write the history report to a file")
    .option("--max-log-mb <number>", "Maximum combined log size per run in MB", parsePositive, 10)
    .action(async (options: CommonOptions & { repo: string; workflow: string; limit: number }) => {
      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      const client = new GithubClient(options.repo, token);
      const report = await client.analyzeHistory(
        options.workflow,
        options.limit,
        { maxBytes: Math.floor(options.maxLogMb * 1024 * 1024) }
      );
      await emit(renderHistoryReport(report, options.format), options.output);
    });

  program.command("init")
    .description("Create a safe GitHub Action workflow for FailSift.")
    .argument("[directory]", "Repository directory", ".")
    .option("-w, --workflow <name>", "CI workflow name to watch; repeat for more than one", collect, [])
    .option("-o, --output <path>", "Workflow path inside the repository", ".github/workflows/failsift.yml")
    .option("--dry-run", "Print the workflow without writing it")
    .option("--force", "Replace a different existing workflow")
    .action(async (directory: string, options: {
      workflow: string[];
      output: string;
      dryRun?: boolean;
      force?: boolean;
    }) => {
      const result = await initialize({
        directory,
        workflows: options.workflow,
        output: options.output,
        dryRun: options.dryRun ?? false,
        force: options.force ?? false
      });
      if (result.status === "preview") {
        process.stdout.write(result.content);
        return;
      }
      const watched = result.workflows.map((name) => `\"${name}\"`).join(", ");
      process.stdout.write(`FailSift workflow ${result.status}: ${result.outputPath}\nWatching: ${watched}\n`);
    });

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") return 0;
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    if (error instanceof FailSiftError) {
      process.stderr.write(`FailSift: ${error.message}\n`);
      return error.exitCode;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`FailSift: ${message}\n`);
    return error instanceof InputError ? 2 : 2;
  }
}

async function emit(content: string, output?: string): Promise<void> {
  if (!output) {
    process.stdout.write(content);
    return;
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, content, "utf8");
  process.stdout.write(`FailSift report written to ${output}\n`);
}

function parseFormat(value: string): OutputFormat {
  if (value === "terminal" || value === "markdown" || value === "json") return value;
  throw new InvalidArgumentError("format must be terminal, markdown, or json");
}

function parsePositive(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new InvalidArgumentError("value must be positive");
  return parsed;
}

function parseInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new InvalidArgumentError("run ID must be a positive integer");
  return parsed;
}

function parseHistoryLimit(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 25) {
    throw new InvalidArgumentError("history limit must be an integer from 1 to 25");
  }
  return parsed;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/gu, "/")}`).href) {
  process.exitCode = await main();
}
