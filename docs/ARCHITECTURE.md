# Architecture

FailSift separates untrusted input handling from diagnosis and presentation.

```text
file, stdin, or GitHub API
          |
     bounded reader
          |
       redactor
          |
      normalizer
          |
   deterministic parsers
          |
 ranking and deduplication
          |
 stable fingerprint + report
          |
 terminal / Markdown / JSON
```

## Trust Boundaries

Logs and GitHub event data are untrusted strings. They never become shell commands, template expressions, JavaScript, or HTML. Markdown output escapes HTML, pipes, backticks, and line breaks.

The Action analyzes only completed runs. It lists failed jobs and reads their plain-text logs through GitHub's REST API. It does not check out a branch or consume artifacts.

## Ranking

Each parser emits candidates with a category, framework, location, message, score, and optional next step. Ranking adds small bonuses for precise locations and early evidence, then penalizes generic cascade messages such as process exit codes. Equivalent candidates are deduplicated using a normalized SHA-256 fingerprint.

Confidence is based on the winning score: specific compiler and test formats are high confidence, explicit generic errors are medium confidence, and process-only signals are low confidence.

## Limits

The default limit is 50 MB and 200,000 lines. Local streams stop when the byte limit is crossed. GitHub downloads are bounded per remaining aggregate budget. Inputs are rejected rather than silently truncated.
