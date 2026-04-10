import { Octokit, SimilarityAnalysis } from "../types";

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function extractIssueNumber(prBody: string): number | null {
  // Match common patterns: "fixes #123", "closes #123", "resolves #123", "#123"
  const patterns = [
    /(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s+#(\d+)/i,
    /(?:^|\s)#(\d+)(?:\s|$)/,
  ];

  for (const pattern of patterns) {
    const match = prBody.match(pattern);
    if (match) return parseInt(match[1], 10);
  }

  return null;
}

export async function analyzeSimilarity(
  octokit: Octokit,
  owner: string,
  repo: string,
  prBody: string
): Promise<SimilarityAnalysis> {
  const prTokens = tokenize(prBody);
  const issueNumber = extractIssueNumber(prBody);

  let similarityScore: number | null = null;
  let issueBodyWordCount: number | null = null;

  if (issueNumber) {
    try {
      const { data: issue } = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      if (issue.body) {
        const issueTokens = tokenize(issue.body);
        similarityScore = Math.round(jaccardSimilarity(prTokens, issueTokens) * 100) / 100;
        issueBodyWordCount = issueTokens.size;
      }
    } catch {
      // Issue not found or inaccessible; skip similarity
    }
  }

  return {
    referencedIssueNumber: issueNumber,
    similarityScore,
    prDescriptionWordCount: prTokens.size,
    issueBodyWordCount,
  };
}
