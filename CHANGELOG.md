# Changelog

All notable changes are documented here. FailSift follows Semantic Versioning.

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
