# Adoption And Validation

FailSift will be evaluated by usefulness rather than manufactured engagement.

## Beta Success Signals

- The correct cause ranks first in at least 85% of the maintained fixture set.
- Reports reduce visible log volume by at least 95% on long fixtures without hiding the error location.
- Setup takes less than five minutes in a repository with GitHub Actions.
- No known secret fixture appears in terminal, Markdown, JSON, or Action output.
- External feedback produces reproducible issues or parser fixtures.

## Public Evidence

Adoption can be measured through npm downloads, public workflow references to `danisantgry/failsift`, external issues, and pull requests. FailSift has no product telemetry and will not fabricate users, stars, reports, or testimonials.

## Beta Requests

Maintainers can open a feedback issue with the ecosystem, CI provider, and a fully anonymized excerpt. Private logs should never be attached to a public issue.

## Five-minute beta

Start with the complete local diagnosis before changing a repository:

```bash
npx failsift demo
```

The built-in example is deterministic, synthetic, and requires no credentials or network access after package download.

1. Add the workflow with `npx failsift init` without changing the existing CI workflow.
2. Let it observe one failed run or trigger a safe failure on a branch.
3. Check whether the first reported failure points to the real repair.
4. Open a feedback issue with the fingerprint and an anonymized excerpt when it does not.

To find repeat offenders before installing the Action, analyze recent failures from a public repository:

```bash
export GH_TOKEN="$(gh auth token)"
npx failsift history --repo owner/repo --workflow ci.yml --limit 10
```

On PowerShell, use `$env:GH_TOKEN = gh auth token`.

The history report contains redacted diagnoses and run links, not raw logs. Set `GH_TOKEN` with Actions read access; the token is sent only to `api.github.com` and never appears in report output.

The useful question is not whether every failure can be recognized. It is whether FailSift shortens the path from a red CI run to the first productive local command.
