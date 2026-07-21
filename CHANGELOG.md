# Changelog

All notable changes are documented here. FailSift follows Semantic Versioning.

## [0.5.0] - 2026-07-21

### Added

- `failsift demo` provides an immediate, deterministic diagnosis without files, credentials, or network access.
- The built-in demo exercises Rust ranking, typed redaction, source locations, suggestions, and noise reduction across 8,247 synthetic lines.

### Improved

- Noise reduction percentages are floored so a non-empty diagnosis cannot overstate `99.x%` as `100%`.

## [0.4.1] - 2026-07-18

### Fixed

- GitHub commands now fail early with an actionable authentication message when neither `GH_TOKEN` nor `GITHUB_TOKEN` is set.
- History documentation reflects the token requirement observed for GitHub job-log downloads.

## [0.4.0] - 2026-07-18

### Added

- `failsift history` for grouping recurring root causes across recent failed workflow runs.
- Terminal, Markdown, and versioned JSON history reports with occurrence share and safe run links.
- Bounded history retrieval for public or private repositories using workflow file names or numeric IDs.

### Improved

- Controlled failure demos now isolate each ecosystem so workflow script text cannot contaminate diagnosis.
- GitHub log normalization ignores group labels and echoed shell source, preventing command text from outranking real output.
- GitHub Actions setup uses `actions/setup-node@v7` after cross-platform validation.

### Security

- History scans are capped at 25 runs, process logs sequentially, and retain only redacted structured diagnoses.

## [0.3.0] - 2026-07-15

### Added

- `failsift init` for one-command, auto-detected GitHub Action setup.
- Safe setup controls for dry runs, explicit workflow selection, custom in-repository output, and intentional replacement.

### Security

- Markdown control characters and backslashes are neutralized with numeric entities, closing an incomplete escaping alert.
- Generated workflows stay inside the target repository and use only `actions: read`, `contents: read`, and `pull-requests: write`.

## [0.2.0] - 2026-07-14

### Added

- Go build, test, module-resolution, and panic diagnostics.
- Rust compiler, Cargo dependency, and Cargo test-panic diagnostics.
- Go and Rust scenarios in the public controlled-failure workflow.
- One-command public demo and GitHub Marketplace discovery link.

### Improved

- Generic process wrappers no longer outrank or duplicate ecosystem-specific root causes.
- Parser documentation now lists built-in parser IDs and overlap expectations.

## [0.1.0] - 2026-07-10

### Added

- Local CLI for file, stdin, and completed GitHub Actions run analysis.
- Secret and personal-identifier redaction before parsing.
- Deterministic TypeScript, ESLint, Vitest/Jest, package-manager, pytest, and generic parsers.
- Ranked primary and secondary failures with stable fingerprints.
- Terminal, Markdown, and versioned JSON reports.
- GitHub Action with failed-job filtering and idempotent pull request comments.
- Strict input limits, security documentation, fixtures, and cross-platform quality gates.
