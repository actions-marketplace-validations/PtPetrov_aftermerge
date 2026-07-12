function percent(value) {
    return value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
}
function horizonRow(horizon) {
    if (horizon.status === "pending") {
        return `| ${horizon.days} days | Pending | ${horizon.trackedLines} | — | — | — |`;
    }
    return `| ${horizon.days} days | Ready | ${horizon.trackedLines} | ${horizon.survivingLines ?? 0} | ${percent(horizon.survivalRate)} | ${percent(horizon.turnoverRate)} |`;
}
export function renderMarkdown(report) {
    const signalLines = report.horizons.flatMap((horizon) => [
        ...horizon.explicitReverts.map((signal) => `- **Explicit revert by day ${horizon.days}:** \`${signal.sha.slice(0, 8)}\` ${signal.subject}`),
        ...horizon.likelyFixes.map((signal) => `- **Possible follow-up fix by day ${horizon.days}:** \`${signal.sha.slice(0, 8)}\` ${signal.subject}`),
    ]);
    return [
        `# AfterMerge report: ${report.pullRequest.repository}#${report.pullRequest.number}`,
        "",
        `**PR:** [${report.pullRequest.title}](${report.pullRequest.url})`,
        `**Author:** \`${report.pullRequest.author}\``,
        `**Merged:** ${report.pullRequest.mergedAt}`,
        `**Tracked:** ${report.trackedLines} non-blank added lines across ${report.trackedFiles.length} files`,
        "",
        "| Horizon | Status | Tracked lines | Surviving lines | Survival | Turnover |",
        "| --- | --- | ---: | ---: | ---: | ---: |",
        ...report.horizons.map(horizonRow),
        "",
        "## Context signals",
        "",
        ...(signalLines.length > 0 ? signalLines : ["No explicit reverts or likely follow-up fixes detected."]),
        "",
        "## Interpretation limits",
        "",
        ...report.limitations.map((limitation) => `- ${limitation}`),
        "",
        `_Generated ${report.generatedAt}_`,
    ].join("\n");
}
export function renderPortfolioMarkdown(reports) {
    if (reports.length === 0) {
        return [
            "# AfterMerge portfolio report",
            "",
            "No merged pull requests matched the configured agent authors and time window.",
        ].join("\n");
    }
    return [
        "# AfterMerge portfolio report",
        "",
        `Analyzed ${reports.length} merged agent-authored pull request${reports.length === 1 ? "" : "s"}.`,
        "",
        ...reports.flatMap((report) => [
            renderMarkdown(report).replace(/^## /gm, "### ").replace(/^# /, "## "),
            "",
            "---",
            "",
        ]),
    ].join("\n");
}
//# sourceMappingURL=report.js.map