# FailSift

[![CI](https://github.com/danisantgry/failsift/actions/workflows/ci.yml/badge.svg)](https://github.com/danisantgry/failsift/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/failsift?color=cb3837)](https://www.npmjs.com/package/failsift)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-FailSift-2088ff?logo=github)](https://github.com/marketplace/actions/failsift-ci-failure-diagnosis)
[![License: MIT](https://img.shields.io/badge/license-MIT-2f855a.svg)](LICENSE)
[![No telemetry](https://img.shields.io/badge/telemetry-none-2563eb.svg)](PRIVACY.md)

FailSift turns noisy CI logs into a concise, secret-safe diagnosis. It ranks the likely root cause, separates cascade failures, suggests a next step, and emits terminal, Markdown, or versioned JSON reports.

```bash
npx failsift demo
```

That command analyzes 8,247 synthetic CI lines locally and returns the root cause, source location, stable fingerprint, and next steps. It needs no install, file, account, token, or network access after npm downloads the package.

![FailSift terminal diagnosis](docs/demo.svg)

If FailSift shortens your path from red build to useful fix, [starring the repository](https://github.com/danisantgry/failsift) helps other maintainers discover it.

## Why FailSift

A failed CI run often ends with a generic exit code while the useful error is buried thousands of lines earlier. FailSift applies deterministic parsers locally, redacts sensitive values before analysis, and reports the highest-signal failure without executing any log content.

- No account, service, model, API key, or telemetry.
- TypeScript, ESLint, Vitest/Jest, npm/pnpm/yarn, pytest, Go, Rust/Cargo, and generic runtime failures.
- Stable fingerprints for grouping recurring failures.
- History analysis that identifies repeat offenders across recent failed runs.
- Safe GitHub Action for completed workflow runs.
- Idempotent pull request comments instead of one new comment per rerun.

## Install The Action

Add FailSift to an existing GitHub repository in one command:

```bash
cd your-repository
npx failsift init
```

FailSift detects the primary CI workflow and creates `.github/workflows/failsift.yml` with least-privilege permissions. It will not replace an existing file unless you explicitly pass `--force`. Preview the generated workflow first with `npx failsift init --dry-run`.

Try FailSift against a safe example log without cloning the repository:

```bash
curl -fsSL https://raw.githubusercontent.com/danisantgry/failsift/main/test/fixtures/rust-compile.log | npx failsift analyze -
```

Analyze a downloaded log:

```bash
npx failsift analyze ./ci.log
```

Pipe logs directly from GitHub CLI:

```bash
gh run view 123456 --log | npx failsift analyze -
```

Generate a report for automation:

```bash
npx failsift analyze ./ci.log --format json --output failsift-report.json
```

Find failures that keep returning across recent GitHub Actions runs:

```bash
export GH_TOKEN="$(gh auth token)"
npx failsift history --repo owner/repo --workflow ci.yml --limit 10
```

PowerShell users can set the token with `$env:GH_TOKEN = gh auth token`.

Example result:

```text
FailSift report (high confidence)
Source: ci.log

Primary: [TypeScript] TS2322: Type 'string' is not assignable to type 'number'.
Location: src/config.ts:18:7
Fingerprint: fs1-4d5be8a87a87a066
```

## GitHub Action

The fastest setup is `npx failsift init`. For manual installation, create `.github/workflows/failsift.yml` in the repository that should receive diagnoses:

```yaml
name: FailSift

on:
  workflow_run:
    workflows: [CI]
    types: [completed]

permissions:
  actions: read
  contents: read
  pull-requests: write

jobs:
  diagnose:
    if: github.event.workflow_run.conclusion == 'failure'
    runs-on: ubuntu-latest
    steps:
      - uses: danisantgry/failsift@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          run-id: ${{ github.event.workflow_run.id }}
```

The analyzer runs only after the original workflow completes. It downloads logs for failed jobs, never checks out pull request code, never executes log content, and uses the minimum permissions shown above. If no pull request is associated with the run, the report is written to the Action job summary only.

Want to see it before installing? Open the [controlled failure workflow](https://github.com/danisantgry/failsift/actions/workflows/demo-failure.yml) and inspect the following FailSift run. The scenarios cover TypeScript, pytest, Go, and Rust with synthetic, secret-free logs.

For stronger supply-chain pinning, replace `@v0` with a full release commit SHA.

## CLI

```text
failsift analyze <file|-> [--format terminal|markdown|json]
failsift demo [--format terminal|markdown|json]
failsift analyze <file> --output <path> [--max-log-mb 50]
failsift github --repo owner/repo --run 123456 [--format markdown]
failsift history --repo owner/repo --workflow ci.yml [--limit 10]
failsift init [directory] [--workflow CI] [--dry-run]
```

`failsift github` and `failsift history` read `GH_TOKEN` or `GITHUB_TOKEN`. Successful analysis exits with code `0` even when the analyzed log describes a failure. Invalid input exits `2`; GitHub authentication or network failures exit `3`.

The JSON output is versioned with `schemaVersion: 1` and includes the source, primary and secondary failures, frameworks, suggestions, fingerprint, confidence, redaction count, limits, and reduction percentage.

### Recurring failure history

`failsift history` reads up to 25 recent failed runs for one workflow, analyzes each failed job independently, and groups matching root causes by stable fingerprint. It shows occurrence count, share of actionable failures, and links to the affected runs:

```text
Recurring failure groups:
1. 3x / 60% [TypeScript] TS2322: Type 'string' is not assignable to type 'number'.
   Fingerprint: fs1-4d5be8a87a87a066
   Runs: #184, #181, #179
```

Use the workflow file name or numeric workflow ID. GitHub log downloads require `GH_TOKEN` or `GITHUB_TOKEN`; a fine-grained token needs Actions read access. The token is sent only to `api.github.com` and is never included in a report. The default is 10 runs and 10 MB of combined failed-job logs per run. JSON and Markdown output use the same `--format` and `--output` options as single-run analysis.

### Safe setup command

`failsift init` parses workflow files as YAML, selects the most likely CI workflow, and writes only inside the selected repository. Repeat `--workflow` to watch more than one workflow:

```bash
npx failsift init --workflow CI --workflow "Integration Tests"
```

Existing files are preserved by default. Use `--output` to choose another path, `--dry-run` to print without writing, or `--force` only after reviewing a workflow that you intentionally want to replace.

## How It Works

```text
bounded input -> redaction -> normalization -> deterministic parsers
              -> ranking + deduplication -> fingerprint -> renderer
```

Parsers emit evidence rather than final prose. The ranking layer favors specific compiler and test errors, penalizes generic cascade messages, and deduplicates equivalent signals. See [the architecture](docs/ARCHITECTURE.md) and [parser guide](docs/PARSER_GUIDE.md).

## Privacy And Security

FailSift is local-first and has no telemetry. It removes common tokens, credentials, JWTs, API keys, email addresses, and user home paths before parsing or rendering. Logs are always treated as untrusted text.

Read [PRIVACY.md](PRIVACY.md) for the data model and [SECURITY.md](SECURITY.md) for responsible disclosure and Action hardening guidance. Redaction is defense in depth, so maintainers should still avoid placing secrets in CI output.

## Supported Signals

| Ecosystem | Signals |
| --- | --- |
| TypeScript | Compiler codes, files, lines, and columns |
| ESLint | Rule, file, line, and column |
| Vitest/Jest | Failed test files and assertion errors |
| npm/pnpm/yarn | Dependency resolution and lifecycle failures |
| pytest | Failed tests and exception summaries |
| Go | Build errors, failed tests, module resolution, and panics |
| Rust/Cargo | Compiler codes, source locations, dependency resolution, and test panics |
| Generic CI | Fatal errors, runtime errors, timeouts, and exit cascades |

## Development

Requires Node.js 20 or newer:

```bash
npm install
npm run check
npm run dev -- analyze test/fixtures/typescript.log
```

The quality gate runs strict TypeScript checks, behavioral tests, coverage thresholds of 90% for lines/functions/statements and 85% for branches, and a deterministic Action bundle build.

## Contributing

Real anonymized failure formats are especially valuable. Start with [CONTRIBUTING.md](CONTRIBUTING.md), open a parser request using the issue template, or pick a labeled good first issue. Never attach a raw log until you have checked it for secrets and personal data.

## Roadmap

- Validate the diagnosis against real public CI failures.
- Compare failed and successful reruns to identify likely flaky tests.
- Add opt-in parser packs for additional ecosystems.
- Consider optional AI explanations only for already-redacted structured reports.

## License

[MIT](LICENSE)
