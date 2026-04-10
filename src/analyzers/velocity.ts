import { Octokit, VelocityAnalysis } from "../types";

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

async function searchPRs(
  octokit: Octokit,
  username: string,
  since: string
): Promise<{ totalCount: number; repos: Set<string> }> {
  const repos = new Set<string>();
  let totalCount = 0;
  let page = 1;
  const perPage = 100;

  // Paginate to collect unique repos, but cap at 3 pages to stay within rate limits
  while (page <= 3) {
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q: `author:${username} type:pr created:>=${since}`,
      per_page: perPage,
      page,
      sort: "created",
      order: "desc",
    });

    if (page === 1) {
      totalCount = data.total_count;
    }

    for (const item of data.items) {
      // Extract repo from the repository_url
      const repoUrl = item.repository_url || "";
      const parts = repoUrl.split("/");
      const repoFullName = parts.slice(-2).join("/");
      if (repoFullName) repos.add(repoFullName);
    }

    if (data.items.length < perPage) break;
    page++;
  }

  return { totalCount, repos };
}

export async function analyzeVelocity(
  octokit: Octokit,
  username: string
): Promise<VelocityAnalysis> {
  const [last7, last30] = await Promise.all([
    searchPRs(octokit, username, daysAgo(7)),
    searchPRs(octokit, username, daysAgo(30)),
  ]);

  return {
    prsLast7Days: last7.totalCount,
    prsLast30Days: last30.totalCount,
    uniqueReposLast7Days: last7.repos.size,
    uniqueReposLast30Days: last30.repos.size,
  };
}
