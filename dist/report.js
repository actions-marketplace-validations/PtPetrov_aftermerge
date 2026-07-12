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
    const seenSignals = new Set();
    const signalLines = report.horizons.flatMap((horizon) => [
        ...horizon.explicitReverts.flatMap((signal) => {
            const key = `revert:${signal.sha}`;
            if (seenSignals.has(key))
                return [];
            seenSignals.add(key);
            return [
                `- **Explicit revert by day ${horizon.days}:** \`${signal.sha.slice(0, 8)}\` ${signal.subject}`,
            ];
        }),
        ...horizon.likelyFixes.flatMap((signal) => {
            const key = `fix:${signal.sha}`;
            if (seenSignals.has(key))
                return [];
            seenSignals.add(key);
            return [
                `- **Fix-labeled commit touching a tracked file by day ${horizon.days}:** \`${signal.sha.slice(0, 8)}\` ${signal.subject}`,
            ];
        }),
    ]);
    const shownSignals = signalLines.slice(0, 10);
    if (signalLines.length > shownSignals.length) {
        shownSignals.push(`- ${signalLines.length - shownSignals.length} additional context signals are available in JSON output.`);
    }
    const fileTurnover = report.horizons
        .find((horizon) => horizon.days === 30 && horizon.status === "ready")
        ?.files?.filter((file) => file.turnoverRate > 0)
        .slice(0, 10);
    const categoryTurnover = report.horizons.find((horizon) => horizon.days === 30 && horizon.status === "ready")?.categories;
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
        ...(categoryTurnover && categoryTurnover.length > 0
            ? [
                "## 30-day composition",
                "",
                "| Category | Tracked lines | Surviving lines | Turnover |",
                "| --- | ---: | ---: | ---: |",
                ...categoryTurnover.map((category) => `| ${category.category} | ${category.trackedLines} | ${category.survivingLines} | ${percent(category.turnoverRate)} |`),
                "",
            ]
            : []),
        ...(fileTurnover && fileTurnover.length > 0
            ? [
                "## Highest 30-day file turnover",
                "",
                "| File | Category | Tracked lines | Surviving lines | Turnover |",
                "| --- | --- | ---: | ---: | ---: |",
                ...fileTurnover.map((file) => `| \`${file.path.replace(/\|/g, "\\|")}\` | ${file.category} | ${file.trackedLines} | ${file.survivingLines} | ${percent(file.turnoverRate)} |`),
                "",
            ]
            : []),
        "## Context signals",
        "",
        ...(shownSignals.length > 0
            ? shownSignals
            : ["No explicit reverts or fix-labeled commits touching tracked files were detected."]),
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