export function buildHistoryReport(repository, workflow, analyses) {
    const grouped = new Map();
    const unclassifiedRuns = [];
    let redactionCount = 0;
    for (const analysis of analyses) {
        redactionCount += analysis.report.redactionCount;
        const failure = analysis.report.primaryFailure;
        if (!failure || !analysis.report.fingerprint) {
            unclassifiedRuns.push(analysis.run);
            continue;
        }
        const existing = grouped.get(analysis.report.fingerprint);
        if (existing) {
            existing.occurrences += 1;
            existing.runs.push(analysis.run);
            continue;
        }
        grouped.set(analysis.report.fingerprint, {
            fingerprint: analysis.report.fingerprint,
            framework: failure.framework,
            category: failure.category,
            message: failure.message,
            ...(failure.file ? { file: failure.file } : {}),
            occurrences: 1,
            sharePercent: 0,
            runs: [analysis.run]
        });
    }
    const actionableRuns = analyses.length - unclassifiedRuns.length;
    const failureGroups = [...grouped.values()];
    for (const group of failureGroups) {
        group.sharePercent = Math.round((group.occurrences / actionableRuns) * 100);
    }
    failureGroups.sort((left, right) => right.occurrences - left.occurrences
        || Date.parse(right.runs[0].createdAt) - Date.parse(left.runs[0].createdAt)
        || left.fingerprint.localeCompare(right.fingerprint));
    return {
        schemaVersion: 1,
        source: { kind: "github-history", repository, workflow },
        runsAnalyzed: analyses.length,
        actionableRuns,
        unclassifiedRuns,
        uniqueFingerprints: failureGroups.length,
        recurringFingerprints: failureGroups.filter((group) => group.occurrences > 1).length,
        redactionCount,
        failureGroups
    };
}
