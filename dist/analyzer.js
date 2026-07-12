const DAY_MS = 24 * 60 * 60 * 1000;
function identityKey(identity) {
    return `${identity.path}:${identity.commit}:${identity.originalLine}`;
}
export async function analyzePullRequest(repository, pullRequest, options = {}) {
    const horizons = options.horizons ?? [7, 30];
    const now = options.now ?? new Date();
    const baseline = pullRequest.mergeCommitSha;
    await repository.ensureCommit(baseline);
    const baselineParent = await repository.firstParent(baseline);
    const resolvedHead = options.head
        ? await repository.resolve(options.head)
        : await repository.resolveFirst([
            `origin/${pullRequest.baseRef}`,
            "origin/HEAD",
            "HEAD",
        ]);
    const addedRanges = await repository.addedRanges(baselineParent, baseline);
    const trackedFiles = [...new Set(addedRanges.map((range) => range.path))].sort();
    const baselineBlames = new Map();
    for (const path of trackedFiles) {
        baselineBlames.set(path, await repository.blame(baseline, path));
    }
    const tracked = addedRanges.flatMap((range) => {
        const end = range.start + range.count;
        return (baselineBlames.get(range.path) ?? []).filter((line) => line.finalLine >= range.start &&
            line.finalLine < end &&
            line.content.trim().length > 0);
    });
    const uniqueTracked = new Map(tracked.map((line) => [identityKey(line), line]));
    const mergedAt = new Date(pullRequest.mergedAt);
    const horizonResults = [];
    for (const days of horizons) {
        const targetDate = new Date(mergedAt.getTime() + days * DAY_MS);
        if (targetDate > now) {
            horizonResults.push({
                days,
                status: "pending",
                targetDate: targetDate.toISOString(),
                trackedLines: uniqueTracked.size,
                explicitReverts: [],
                likelyFixes: [],
            });
            continue;
        }
        const targetCommit = await repository.commitAtOrBefore(resolvedHead, targetDate, baseline);
        const targetIdentities = new Set();
        for (const path of trackedFiles) {
            for (const identity of await repository.blame(targetCommit, path)) {
                targetIdentities.add(identityKey(identity));
            }
        }
        const survivingLines = [...uniqueTracked.keys()].filter((key) => targetIdentities.has(key)).length;
        const survivalRate = uniqueTracked.size === 0 ? 1 : survivingLines / uniqueTracked.size;
        const signals = await repository.signals(baseline, targetCommit, trackedFiles, [baseline, ...pullRequest.commitShas]);
        horizonResults.push({
            days,
            status: "ready",
            targetDate: targetDate.toISOString(),
            targetCommit,
            trackedLines: uniqueTracked.size,
            survivingLines,
            survivalRate,
            turnoverRate: 1 - survivalRate,
            ...signals,
        });
    }
    return {
        schemaVersion: 1,
        generatedAt: now.toISOString(),
        pullRequest,
        baselineCommit: baseline,
        baselineParent,
        trackedFiles,
        trackedLines: uniqueTracked.size,
        horizons: horizonResults,
        limitations: [
            "Turnover is not the same as a defect; intentional deletion and refactoring also count.",
            "The proof tracks non-blank added lines in their original files; cross-file moves may count as turnover.",
            "Likely follow-up fixes are inferred from commit subjects and require human interpretation.",
            "The analyzer measures committed Git history and does not attempt probabilistic AI-code detection.",
            "If the original base branch was deleted, the analyzer follows the current remote default branch or local HEAD.",
        ],
    };
}
//# sourceMappingURL=analyzer.js.map