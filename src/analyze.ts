import { createHash } from "node:crypto";
import { measureInput, resolveLimits } from "./input.js";
import { normalize } from "./normalize.js";
import { builtInParsers } from "./parsers.js";
import { redact } from "./redact.js";
import type {
  AnalysisReport,
  AnalyzeOptions,
  Confidence,
  Failure,
  FailureCandidate,
  Parser
} from "./types.js";

export function analyzeText(
  input: string,
  options: AnalyzeOptions,
  parsers: Parser[] = builtInParsers
): AnalysisReport {
  const limits = resolveLimits(options.limits);
  const limitsApplied = measureInput(input, limits);
  const redacted = redact(input);
  const lines = normalize(redacted.text);
  const candidates = parsers.flatMap((parser) => parser.parse(lines));
  const ranked = rankAndDedupe(candidates, Math.max(lines.length, 1));
  const failures = ranked.slice(0, 6).map(toFailure);
  const primaryFailure = failures[0] ?? null;
  const secondaryFailures = failures.slice(1);
  const confidence = confidenceFor(ranked[0]?.adjustedScore ?? 0);
  const frameworks = [...new Set(ranked.map((item) => item.candidate.framework))]
    .filter((framework) => framework !== "Generic")
    .sort();
  const suggestions = [...new Set(failures.flatMap((failure) => failure.suggestion ? [failure.suggestion] : []))]
    .slice(0, 4);
  const reportedLines = failures.length;
  const reductionPercent = limitsApplied.linesRead === 0
    ? 0
    : Math.max(0, Math.floor((1 - reportedLines / limitsApplied.linesRead) * 100));

  return {
    schemaVersion: 1,
    source: options.source,
    summary: primaryFailure
      ? `${primaryFailure.framework} ${primaryFailure.category} failure: ${primaryFailure.message}`
      : "No actionable failure was detected in the supplied log.",
    primaryFailure,
    secondaryFailures,
    frameworks,
    suggestions,
    fingerprint: primaryFailure?.fingerprint ?? null,
    confidence,
    redactionCount: redacted.count,
    limitsApplied,
    reductionPercent
  };
}

interface RankedCandidate {
  candidate: FailureCandidate;
  adjustedScore: number;
  fingerprint: string;
}

function rankAndDedupe(candidates: FailureCandidate[], totalLines: number): RankedCandidate[] {
  const unique = new Map<string, RankedCandidate>();
  for (const candidate of candidates) {
    const fingerprint = fingerprintFor(candidate);
    const dedupeKey = dedupeKeyFor(candidate);
    const positionBonus = Math.max(0, 6 - Math.floor((candidate.lineNumber / totalLines) * 6));
    const adjustedScore = candidate.score
      + positionBonus
      + (candidate.file ? 4 : 0)
      - (candidate.cascade ? 35 : 0);
    const current = unique.get(dedupeKey);
    if (!current || adjustedScore > current.adjustedScore) {
      unique.set(dedupeKey, { candidate, adjustedScore, fingerprint });
    }
  }
  return [...unique.values()].sort((left, right) =>
    right.adjustedScore - left.adjustedScore
    || left.candidate.lineNumber - right.candidate.lineNumber
  );
}

function dedupeKeyFor(candidate: FailureCandidate): string {
  return [candidate.file ?? "", stableMessage(candidate.message)].join("|");
}

function fingerprintFor(candidate: FailureCandidate): string {
  const value = [candidate.category, candidate.framework, candidate.file ?? "", stableMessage(candidate.message)].join("|");
  return `fs1-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function stableMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/0x[\da-f]+/gu, "0x#")
    .replace(/\b\d+\b/gu, "#")
    .replace(/\s+/gu, " ")
    .trim();
}

function toFailure(item: RankedCandidate): Failure {
  const candidate = item.candidate;
  return {
    parser: candidate.parser,
    framework: candidate.framework,
    category: candidate.category,
    message: candidate.message,
    logLine: candidate.lineNumber,
    fingerprint: item.fingerprint,
    ...(candidate.file ? { file: candidate.file } : {}),
    ...(candidate.sourceLine === undefined ? {} : { line: candidate.sourceLine }),
    ...(candidate.column === undefined ? {} : { column: candidate.column }),
    ...(candidate.suggestion ? { suggestion: candidate.suggestion } : {})
  };
}

function confidenceFor(score: number): Confidence {
  if (score >= 90) return "high";
  if (score >= 55) return "medium";
  return "low";
}
