# Privacy

FailSift is local-first software. It does not include telemetry, analytics, user accounts, hosted storage, advertising, or an API service.

## Local CLI

`failsift analyze` reads the file or standard input selected by the user. Processing happens in the local Node.js process. The report is printed locally or written only to the requested output path.

## GitHub Action

The Action uses the supplied GitHub token to read metadata and logs for one completed workflow run. It downloads only failed-job logs. The generated report is written to the GitHub job summary and, when enabled, to the associated pull request.

FailSift does not send logs to the project maintainer or to another service.

## Redaction

Before parsing, FailSift replaces common credentials and personal identifiers with typed placeholders. Covered forms include authorization headers, passwords, API keys, GitHub and npm token patterns, JWTs, email addresses, credential-bearing URLs, and user home directories.

No redactor can guarantee recognition of every secret format. Avoid logging secrets, review generated reports before sharing them outside the repository, and add provider-side masking where available.

## Future AI Integrations

Version 0.1 has no AI integration. Any future integration must be explicitly enabled and may receive only an already-redacted structured report, never the raw log.
