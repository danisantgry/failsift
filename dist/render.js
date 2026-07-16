export function renderReport(report, format) {
    if (format === "json")
        return `${JSON.stringify(report, null, 2)}\n`;
    if (format === "markdown")
        return renderMarkdown(report);
    return renderTerminal(report);
}
export function renderTerminal(report) {
    const lines = [
        `FailSift report (${report.confidence} confidence)`,
        `Source: ${report.source.label}`,
        ""
    ];
    if (!report.primaryFailure) {
        lines.push("No actionable failure detected.");
    }
    else {
        lines.push(`Primary: [${report.primaryFailure.framework}] ${report.primaryFailure.message}`);
        lines.push(`Category: ${report.primaryFailure.category}`);
        lines.push(`Location: ${formatLocation(report.primaryFailure)}`);
        lines.push(`Fingerprint: ${report.fingerprint}`);
    }
    if (report.secondaryFailures.length > 0) {
        lines.push("", "Secondary signals:");
        for (const failure of report.secondaryFailures) {
            lines.push(`- [${failure.framework}] ${failure.message}`);
        }
    }
    if (report.suggestions.length > 0) {
        lines.push("", "Next steps:");
        for (const suggestion of report.suggestions)
            lines.push(`- ${suggestion}`);
    }
    lines.push("", `Reduced ${report.limitsApplied.linesRead.toLocaleString("en-US")} log lines by ${report.reductionPercent}%.`, `Redactions: ${report.redactionCount}`);
    return `${lines.join("\n")}\n`;
}
export function renderMarkdown(report) {
    const source = escapeMarkdown(report.source.label);
    const lines = [
        "## FailSift CI diagnosis",
        "",
        `**Source:** ${source}  `,
        `**Confidence:** ${report.confidence}  `,
        `**Fingerprint:** \`${report.fingerprint ?? "none"}\``,
        ""
    ];
    if (!report.primaryFailure) {
        lines.push("No actionable failure was detected in the supplied log.");
    }
    else {
        lines.push("### Primary failure", "", failureMarkdown(report.primaryFailure));
    }
    if (report.secondaryFailures.length > 0) {
        lines.push("", "<details>", `<summary>Secondary signals (${report.secondaryFailures.length})</summary>`, "");
        for (const failure of report.secondaryFailures)
            lines.push(`- ${failureMarkdown(failure)}`);
        lines.push("", "</details>");
    }
    if (report.suggestions.length > 0) {
        lines.push("", "### Suggested next steps", "");
        for (const suggestion of report.suggestions)
            lines.push(`- ${escapeMarkdown(suggestion)}`);
    }
    lines.push("", "---", `Analyzed ${report.limitsApplied.linesRead.toLocaleString("en-US")} lines; reduced visible noise by ${report.reductionPercent}%; removed ${report.redactionCount} sensitive value${report.redactionCount === 1 ? "" : "s"}.`, "", "_FailSift processes logs as untrusted text and never executes their contents._", "");
    return lines.join("\n");
}
function failureMarkdown(failure) {
    const location = escapeMarkdown(formatLocation(failure));
    return `**${escapeMarkdown(failure.framework)} / ${escapeMarkdown(failure.category)}:** ${escapeMarkdown(failure.message)}<br>\nLocation: ${location} (log line ${failure.logLine})`;
}
function formatLocation(failure) {
    if (!failure.file)
        return `log line ${failure.logLine}`;
    const position = failure.line === undefined
        ? ""
        : `:${failure.line}${failure.column === undefined ? "" : `:${failure.column}`}`;
    return `${failure.file}${position}`;
}
export function escapeMarkdown(value) {
    return value
        .replace(/&/gu, "&amp;")
        .replace(/</gu, "&lt;")
        .replace(/>/gu, "&gt;")
        .replace(/\r?\n/gu, " ")
        .replace(/[\\`*_[\]{}()#!|]/gu, (character) => `&#${character.codePointAt(0)};`);
}
