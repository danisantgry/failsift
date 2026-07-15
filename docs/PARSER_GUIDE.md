# Parser Guide

A parser receives normalized, redacted lines and returns failure candidates. It must be deterministic, side-effect free, and specific enough to avoid claiming unrelated output.

```ts
interface Parser {
  id: string;
  parse(lines: NormalizedLine[]): FailureCandidate[];
}
```

Prefer stable tool markers, error codes, file positions, and assertion formats. Do not classify a line from a single common word such as `failed`. Mark wrapper messages and final exit codes as cascade signals so a specific earlier error wins.

Each parser needs:

1. An anonymized fixture containing the meaningful error and realistic surrounding noise.
2. A test proving the expected primary framework, category, message, and location.
3. A negative or mixed-format case when the signature could overlap another tool.

Scores above 90 are reserved for signatures that identify both the tool and the failure. Generic runtime errors should stay below compiler and test assertions. Process exit summaries should be marked `cascade`.

## Built-in parser IDs

| ID | Primary signals |
| --- | --- |
| `typescript` | TypeScript compiler diagnostics |
| `eslint` | ESLint locations and rules |
| `javascript-tests` | Vitest and Jest assertions |
| `package-manager` | npm, pnpm, and Yarn dependency failures |
| `pytest` | pytest summaries and exceptions |
| `go` | Go build, test, module, and panic output |
| `rust` | rustc, Cargo resolution, and test panic output |
| `generic` | Tool-independent fatal, timeout, and process signals |

When formats overlap, the ecosystem parser should emit a higher-specificity candidate and generic wrappers should be omitted or marked as cascades. A test should verify that the useful diagnostic wins, not merely that a parser matched.
