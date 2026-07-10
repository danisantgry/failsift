# Repository Guidance

## Commands

- Use `npm.cmd` on Windows and `npm` elsewhere.
- Run `npm run lint`, `npm run test:coverage`, and `npm run build` before release work.
- Regenerate `dist/action.cjs` with `npm run build` whenever Action code or runtime dependencies change.

## Security Invariants

- Treat logs, workflow metadata, filenames, and comments as untrusted input.
- Never execute, import, evaluate, or interpolate log content into a shell.
- Redact before parsing and escape before Markdown output.
- Do not add telemetry or transmit raw logs to third parties.
- Do not check out pull request code from the privileged `workflow_run` path.

## Tests

- Parser changes require an anonymized fixture and root-cause ranking assertion.
- Preserve the configured coverage thresholds.
- Keep JSON output backward compatible within schema version 1.
