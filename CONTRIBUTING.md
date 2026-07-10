# Contributing To FailSift

Thanks for helping make CI failures easier to diagnose.

## Setup

```bash
npm install
npm run check
```

## Parser Contributions

Every parser change must include an anonymized fixture and assertions for the expected primary failure. Keep fixtures small while preserving the relevant output shape.

Before committing a fixture:

- Replace tokens, URLs, repository names, usernames, emails, and internal hostnames.
- Keep the first meaningful error and enough surrounding context to distinguish the tool.
- Include cascade messages when they are needed to test ranking.
- Do not include customer data or logs copied from a private repository without permission.

Parsers must remain deterministic and must never execute log content. See [docs/PARSER_GUIDE.md](docs/PARSER_GUIDE.md).

## Pull Requests

Keep changes focused, explain the failure format being supported, and run `npm run check`. New behavior needs tests. Security-sensitive behavior should include a brief threat-model note in the pull request.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
