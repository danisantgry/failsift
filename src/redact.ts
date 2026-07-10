import type { RedactionResult } from "./types.js";

interface Rule {
  pattern: RegExp;
  replace: string | ((substring: string, ...args: string[]) => string);
}

const rules: Rule[] = [
  {
    pattern: /\b(https?:\/\/)([^\s/:@]+):([^\s/@]+)@/giu,
    replace: "$1[REDACTED:USER]:[REDACTED:PASSWORD]@"
  },
  {
    pattern: /\b(authorization\s*[:=]\s*)(bearer|basic)?\s*([^\s,;]+)/giu,
    replace: (_match, prefix, scheme) => `${prefix}${scheme ? `${scheme} ` : ""}[REDACTED:TOKEN]`
  },
  {
    pattern: /\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|passwd|pwd)\s*[:=]\s*)(["']?)([^\s"',;]+)\2/giu,
    replace: "$1[REDACTED:SECRET]"
  },
  {
    pattern: /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|AQ\.[A-Za-z0-9_-]{20,})\b/gu,
    replace: "[REDACTED:TOKEN]"
  },
  {
    pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/gu,
    replace: "[REDACTED:JWT]"
  },
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    replace: "[REDACTED:EMAIL]"
  },
  {
    pattern: /\b([A-Za-z]:\\Users\\)[^\\\s]+/gu,
    replace: "$1[REDACTED:USER]"
  },
  {
    pattern: /(\/(?:home|Users)\/)[^/\s]+/gu,
    replace: "$1[REDACTED:USER]"
  }
];

export function redact(input: string): RedactionResult {
  let text = input;
  let count = 0;

  for (const rule of rules) {
    text = text.replace(rule.pattern, (...args: unknown[]) => {
      count += 1;
      if (typeof rule.replace === "string") {
        const match = String(args[0]);
        return match.replace(rule.pattern, rule.replace);
      }
      return rule.replace(...(args as [string, ...string[]]));
    });
  }

  return { text, count };
}
