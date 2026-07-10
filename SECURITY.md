# Security Policy

## Supported Versions

Security fixes are provided for the latest release line.

## Reporting A Vulnerability

Please use GitHub private vulnerability reporting for this repository. Do not open a public issue containing an exploit, credential, private repository name, or unredacted CI log.

Include the affected version, impact, minimal reproduction, and any suggested mitigation. You can expect an acknowledgement within seven days.

## GitHub Action Threat Model

FailSift treats workflow logs, names, branch metadata, and pull request associations as untrusted data.

- It does not check out or execute pull request code.
- It does not download or execute workflow artifacts.
- It escapes untrusted content before creating Markdown comments.
- It requests only Actions read, Contents read, and Pull Requests write permissions.
- It updates a marker-scoped comment and does not evaluate strings from the event in a shell.

Consumers should pin the Action to a full commit SHA when their supply-chain policy requires immutable dependencies.
