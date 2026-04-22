import { Octokit, OpenPrBuckets, VelocityAnalysis } from "../types";

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

function parseRepoFullName(repositoryUrl: string): string | null {
  const parts = repositoryUrl.split("/").slice(-2);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return parts.join("/");
}

function emptyOpenPrBuckets(): OpenPrBuckets {
  return {
    last30Days: 0,
    days31To90: 0,
    days91To180: 0,
    days181To365: 0,
  };
}

function bucketOpenPr(createdAt: string, buckets: OpenPrBuckets): void {
  const created = new Date(createdAt);
  const ageDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays <= 30) {
    buckets.last30Days++;
  } else if (ageDays <= 90) {
    buckets.days31To90++;
  } else if (ageDays <= 180) {
    buckets.days91To180++;
  } else if (ageDays <= 365) {
    buckets.days181To365++;
  }
}

async function searchOpenPublicPRs(
  octokit: Octokit,
  username: string
): Promise<{
  totalCount: number;
  repos: Set<string>;
  sampleSize: number;
  buckets: OpenPrBuckets;
}> {
  const repos = new Set<string>();
  const repoVisibility = new Map<string, boolean>();
  const buckets = emptyOpenPrBuckets();
  const since = daysAgo(365);
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: `author:${username} type:pr state:open created:>=${since}`,
    per_page: 50,
    page: 1,
    sort: "created",
    order: "desc",
  });

  for (const item of data.items) {
    const repoFullName = parseRepoFullName(item.repository_url || "");
    if (!repoFullName) continue;

    let isPublic = repoVisibility.get(repoFullName);
    if (isPublic == null) {
      const [owner, repo] = repoFullName.split("/");
      try {
        const { data: repository } = await octokit.rest.repos.get({ owner, repo });
        isPublic = repository.private === false;
        repoVisibility.set(repoFullName, isPublic);
      } catch {
        repoVisibility.set(repoFullName, false);
        continue;
      }
    }

    if (!isPublic) continue;

    repos.add(repoFullName);
    bucketOpenPr(item.created_at, buckets);
  }

  return {
    totalCount: buckets.last30Days + buckets.days31To90 + buckets.days91To180 + buckets.days181To365,
    repos,
    sampleSize: data.items.length,
    buckets,
  };
}

export async function analyzeVelocity(
  octokit: Octokit,
  username: string
): Promise<VelocityAnalysis> {
  const [last7, last30, openPublic] = await Promise.all([
    searchPRs(octokit, username, daysAgo(7)),
    searchPRs(octokit, username, daysAgo(30)),
    searchOpenPublicPRs(octokit, username),
  ]);

  return {
    prsLast7Days: last7.totalCount,
    prsLast30Days: last30.totalCount,
    uniqueReposLast7Days: last7.repos.size,
    uniqueReposLast30Days: last30.repos.size,
    openPublicPrsLastYear: openPublic.totalCount,
    openPublicReposLastYear: openPublic.repos.size,
    openPublicPrSampleSize: openPublic.sampleSize,
    openPublicPrBuckets: openPublic.buckets,
  };
}
