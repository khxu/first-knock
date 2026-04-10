import { analyzeSimilarity } from "../src/analyzers/similarity";

// Mock octokit for testing
function createMockOctokit(issueBody: string | null) {
  return {
    rest: {
      issues: {
        get: jest.fn().mockResolvedValue({
          data: { body: issueBody },
        }),
      },
    },
  } as any;
}

describe("analyzeSimilarity", () => {
  it("extracts issue number from 'fixes #123' pattern", async () => {
    const octokit = createMockOctokit("This is a bug report about login failures");
    const result = await analyzeSimilarity(
      octokit,
      "owner",
      "repo",
      "Fixes #123\n\nThis PR fixes the login failure issue"
    );

    expect(result.referencedIssueNumber).toBe(123);
    expect(result.similarityScore).not.toBeNull();
  });

  it("extracts issue number from 'closes #456' pattern", async () => {
    const octokit = createMockOctokit("Some issue body");
    const result = await analyzeSimilarity(
      octokit,
      "owner",
      "repo",
      "Closes #456"
    );

    expect(result.referencedIssueNumber).toBe(456);
  });

  it("returns null when no issue is referenced", async () => {
    const octokit = createMockOctokit(null);
    const result = await analyzeSimilarity(
      octokit,
      "owner",
      "repo",
      "This PR improves performance of the rendering engine"
    );

    expect(result.referencedIssueNumber).toBeNull();
    expect(result.similarityScore).toBeNull();
  });

  it("calculates high similarity for near-identical text", async () => {
    const text = "Fix the login page validation error when email contains plus sign";
    const octokit = createMockOctokit(text);
    const result = await analyzeSimilarity(
      octokit,
      "owner",
      "repo",
      `Fixes #1\n\n${text}`
    );

    expect(result.similarityScore).toBeGreaterThan(0.7);
  });

  it("calculates low similarity for unrelated text", async () => {
    const octokit = createMockOctokit(
      "The database migration script fails on PostgreSQL 15"
    );
    const result = await analyzeSimilarity(
      octokit,
      "owner",
      "repo",
      "Fixes #1\n\nRefactored the CSS grid layout for the dashboard header"
    );

    expect(result.similarityScore).toBeLessThan(0.3);
  });

  it("handles empty PR body", async () => {
    const octokit = createMockOctokit(null);
    const result = await analyzeSimilarity(octokit, "owner", "repo", "");

    expect(result.prDescriptionWordCount).toBe(0);
    expect(result.referencedIssueNumber).toBeNull();
  });

  it("handles issue fetch failure gracefully", async () => {
    const octokit = {
      rest: {
        issues: {
          get: jest.fn().mockRejectedValue(new Error("Not found")),
        },
      },
    } as any;

    const result = await analyzeSimilarity(
      octokit,
      "owner",
      "repo",
      "Fixes #999\n\nSome description"
    );

    expect(result.referencedIssueNumber).toBe(999);
    expect(result.similarityScore).toBeNull();
  });
});
