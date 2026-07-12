import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../src/github.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHubClient.discoverMergedPullRequests", () => {
  it("selects recent merged PRs from configured agent accounts", async () => {
    const request = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("state=closed")) {
        return Response.json([
          {
            number: 7,
            merged_at: "2026-06-10T12:00:00Z",
            user: { login: "Copilot" },
          },
          {
            number: 8,
            merged_at: "2026-06-11T12:00:00Z",
            user: { login: "human" },
          },
          {
            number: 9,
            merged_at: "2025-12-01T12:00:00Z",
            user: { login: "Copilot" },
          },
        ]);
      }
      if (url.endsWith("/pulls/7")) {
        return Response.json({
          number: 7,
          title: "Agent change",
          html_url: "https://github.com/example/project/pull/7",
          merged_at: "2026-06-10T12:00:00Z",
          merge_commit_sha: "a".repeat(40),
          base: { ref: "main", sha: "b".repeat(40) },
          head: { sha: "c".repeat(40) },
          user: { login: "Copilot" },
          labels: [],
        });
      }
      if (url.includes("/pulls/7/commits")) {
        return Response.json([{ sha: "c".repeat(40) }]);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", request);

    const pulls = await new GitHubClient().discoverMergedPullRequests(
      "example/project",
      {
        since: new Date("2026-06-01T00:00:00Z"),
        authors: ["copilot[bot]"],
      },
    );

    expect(pulls).toHaveLength(1);
    expect(pulls[0]?.number).toBe(7);
    expect(pulls[0]?.commitShas).toEqual(["c".repeat(40)]);
    expect(request).toHaveBeenCalledTimes(3);
  });
});
