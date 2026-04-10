import { Octokit, EngagementAnalysis } from "../types";

export async function analyzeEngagement(
  octokit: Octokit,
  owner: string,
  repo: string,
  username: string
): Promise<EngagementAnalysis> {
  // Search for issues authored by this user in this repo
  const issueQuery = `author:${username} repo:${owner}/${repo} type:issue`;
  const prQuery = `author:${username} repo:${owner}/${repo} type:pr`;
  const commentQuery = `commenter:${username} repo:${owner}/${repo}`;

  const [issueResult, prResult, commentResult] = await Promise.all([
    octokit.rest.search.issuesAndPullRequests({
      q: issueQuery,
      per_page: 1,
    }),
    octokit.rest.search.issuesAndPullRequests({
      q: prQuery,
      per_page: 1,
    }),
    octokit.rest.search.issuesAndPullRequests({
      q: commentQuery,
      per_page: 100,
    }),
  ]);

  // The current PR will appear in the PR results, so subtract 1
  const priorPRs = Math.max(0, prResult.data.total_count - 1);

  // Separate issue comments from PR comments in the comment results
  let issueComments = 0;
  let prComments = 0;
  for (const item of commentResult.data.items) {
    // Items with pull_request property are PRs
    if (item.pull_request) {
      prComments++;
    } else {
      issueComments++;
    }
  }

  const priorIssues = issueResult.data.total_count;
  const totalPriorInteractions = priorIssues + priorPRs + issueComments + prComments;

  return {
    priorIssues,
    priorPullRequests: priorPRs,
    priorCommentsOnIssues: issueComments,
    priorCommentsOnPRs: prComments,
    firstInteraction: totalPriorInteractions === 0,
  };
}
