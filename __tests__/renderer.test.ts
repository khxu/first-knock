import { renderContextCard } from "../src/card/renderer";
import { ContributorContext } from "../src/types";

function makeFullContext(): ContributorContext {
  return {
    account: {
      username: "new-contributor",
      accountAgeDays: 3,
      createdAt: "2026-04-07T00:00:00Z",
      publicRepos: 1,
      followers: 0,
      following: 5,
      profile: {
        hasBio: false,
        hasCompany: false,
        hasLocation: false,
        hasBlog: false,
        hasEmail: true,
        filled: 1,
        total: 5,
      },
    },
    engagement: {
      priorIssues: 0,
      priorPullRequests: 0,
      priorCommentsOnIssues: 0,
      priorCommentsOnPRs: 0,
      firstInteraction: true,
    },
    forensics: {
      totalCommits: 3,
      apiCommits: 1,
      localCommits: 2,
      averageDateGapSeconds: 2700,
      maxDateGapSeconds: 5400,
      signedCommits: 0,
    },
    velocity: {
      prsLast7Days: 12,
      prsLast30Days: 45,
      uniqueReposLast7Days: 8,
      uniqueReposLast30Days: 22,
    },
    similarity: {
      referencedIssueNumber: 42,
      similarityScore: 0.85,
      prDescriptionWordCount: 30,
      issueBodyWordCount: 35,
    },
  };
}

describe("renderContextCard", () => {
  it("renders all sections when all analyzers provide data", () => {
    const context = makeFullContext();
    const card = renderContextCard(context, "");

    expect(card).toContain("### Contributor Context");
    expect(card).toContain("@new-contributor");
    expect(card).toContain("3 days ago");
    expect(card).toContain("1 public repo");
    expect(card).toContain("0 followers");
    expect(card).toContain("First interaction with this repository");
    expect(card).toContain("3 commits");
    expect(card).toContain("2 local");
    expect(card).toContain("1 via API");
    expect(card).toContain("12 PRs across 8 repos (7d)");
    expect(card).toContain("#42");
    expect(card).toContain("85%");
    expect(card).toContain("first-knock");
  });

  it("handles null sections gracefully", () => {
    const context: ContributorContext = {
      account: null,
      engagement: null,
      forensics: null,
      velocity: null,
      similarity: null,
    };

    const card = renderContextCard(context, "");
    expect(card).toContain("### Contributor Context");
    expect(card).not.toContain("Account");
    expect(card).not.toContain("Repo history");
  });

  it("uses custom footer when provided", () => {
    const context = makeFullContext();
    const card = renderContextCard(context, "Custom footer text here");

    expect(card).toContain("Custom footer text here");
    expect(card).not.toContain("first-knock");
  });

  it("shows prior interactions when not first interaction", () => {
    const context = makeFullContext();
    context.engagement = {
      priorIssues: 3,
      priorPullRequests: 1,
      priorCommentsOnIssues: 5,
      priorCommentsOnPRs: 2,
      firstInteraction: false,
    };

    const card = renderContextCard(context, "");
    expect(card).toContain("3 prior issues");
    expect(card).toContain("1 prior PR");
    expect(card).toContain("5 issue comments");
    expect(card).toContain("2 PR comments");
  });

  it("handles zero-gap forensics (identical timestamps)", () => {
    const context = makeFullContext();
    context.forensics!.averageDateGapSeconds = 0;

    const card = renderContextCard(context, "");
    expect(card).toContain("author/committer timestamps identical");
  });

  it("handles no referenced issue in similarity", () => {
    const context = makeFullContext();
    context.similarity = {
      referencedIssueNumber: null,
      similarityScore: null,
      prDescriptionWordCount: 15,
      issueBodyWordCount: null,
    };

    const card = renderContextCard(context, "");
    expect(card).toContain("15 unique words");
    expect(card).toContain("no linked issue found");
  });

  it("handles empty PR description", () => {
    const context = makeFullContext();
    context.similarity = {
      referencedIssueNumber: null,
      similarityScore: null,
      prDescriptionWordCount: 0,
      issueBodyWordCount: null,
    };

    const card = renderContextCard(context, "");
    expect(card).toContain("No PR description provided");
  });

  it("formats account age correctly for months", () => {
    const context = makeFullContext();
    context.account!.accountAgeDays = 90;

    const card = renderContextCard(context, "");
    expect(card).toContain("3 months ago");
  });

  it("formats account age correctly for years", () => {
    const context = makeFullContext();
    context.account!.accountAgeDays = 800;

    const card = renderContextCard(context, "");
    expect(card).toContain("2 years");
  });
});
