import { Octokit, CommitForensics } from "../types";

// Commits created through the GitHub web UI, API, or merge button have
// committer set to exactly "GitHub <noreply@github.com>". Users who
// configure their local git with ID+username@users.noreply.github.com
// are making normal local commits and should NOT be flagged as API.
function isApiCommit(commit: { committer: { email?: string; name?: string } | null }): boolean {
  if (!commit.committer) return false;
  const email = (commit.committer.email || "").toLowerCase();
  const name = (commit.committer.name || "").toLowerCase();
  return email === "noreply@github.com" && name === "github";
}

export async function analyzeForensics(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<CommitForensics> {
  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  let apiCommits = 0;
  let localCommits = 0;
  let signedCommits = 0;
  const dateGaps: number[] = [];

  for (const entry of commits) {
    const commitData = entry.commit;

    if (isApiCommit(commitData)) {
      apiCommits++;
    } else {
      localCommits++;
    }

    if (commitData.verification?.verified) {
      signedCommits++;
    }

    if (commitData.author?.date && commitData.committer?.date) {
      const authorDate = new Date(commitData.author.date).getTime();
      const committerDate = new Date(commitData.committer.date).getTime();
      const gapMs = Math.abs(committerDate - authorDate);
      dateGaps.push(gapMs / 1000);
    }
  }

  const averageGap =
    dateGaps.length > 0
      ? dateGaps.reduce((a, b) => a + b, 0) / dateGaps.length
      : 0;

  const maxGap = dateGaps.length > 0 ? Math.max(...dateGaps) : 0;

  return {
    totalCommits: commits.length,
    apiCommits,
    localCommits,
    averageDateGapSeconds: Math.round(averageGap),
    maxDateGapSeconds: Math.round(maxGap),
    signedCommits,
  };
}
