#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { analyzeText } from "./analyze.js";
import { FailSiftError, InputError } from "./errors.js";
import { GithubClient } from "./github.js";
import { readInput, resolveLimits } from "./input.js";
import { renderReport } from "./render.js";
import type { OutputFormat } from "./types.js";

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
    .version("0.1.0")
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

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/gu, "/")}`).href) {
  process.exitCode = await main();
}
