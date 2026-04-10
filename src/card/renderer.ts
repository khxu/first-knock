import {
  ContributorContext,
  AccountAnalysis,
  EngagementAnalysis,
  CommitForensics,
  VelocityAnalysis,
  SimilarityAnalysis,
} from "../types";

function profileField(present: boolean): string {
  return present ? "yes" : "--";
}

function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural || singular + "s"}`;
}

function formatAge(days: number): string {
  if (days === 0) return "today";
  if (days < 30) return `${pluralize(days, "day")} ago`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${pluralize(months, "month")} ago`;
  }
  const years = Math.floor(days / 365);
  const remaining = Math.floor((days % 365) / 30);
  if (remaining === 0) return `${pluralize(years, "year")} ago`;
  return `${pluralize(years, "year")}, ${pluralize(remaining, "month")} ago`;
}

function formatSeconds(seconds: number): string {
  if (seconds < 1) return "<1 second";
  if (seconds < 60) return `${pluralize(Math.round(seconds), "second")}`;
  if (seconds < 3600) return `${pluralize(Math.round(seconds / 60), "minute")}`;
  if (seconds < 86400) return `${pluralize(Math.round(seconds / 3600), "hour")}`;
  return `${pluralize(Math.round(seconds / 86400), "day")}`;
}

function renderAccountRow(a: AccountAnalysis): string {
  const age = formatAge(a.accountAgeDays);
  return (
    `| Account | @${a.username} · created ${age} · ` +
    `${pluralize(a.publicRepos, "public repo")} · ` +
    `${pluralize(a.followers, "follower")} |`
  );
}

function renderProfileRow(a: AccountAnalysis): string {
  const p = a.profile;
  const fields = [
    `bio: ${profileField(p.hasBio)}`,
    `company: ${profileField(p.hasCompany)}`,
    `location: ${profileField(p.hasLocation)}`,
    `website: ${profileField(p.hasBlog)}`,
    `email: ${profileField(p.hasEmail)}`,
  ];
  return `| Profile | ${fields.join(" · ")} |`;
}

function renderEngagementRow(e: EngagementAnalysis): string {
  if (e.firstInteraction) {
    return "| Repo history | First interaction with this repository |";
  }

  const parts: string[] = [];
  if (e.priorIssues > 0) parts.push(pluralize(e.priorIssues, "prior issue"));
  if (e.priorPullRequests > 0) parts.push(pluralize(e.priorPullRequests, "prior PR"));
  if (e.priorCommentsOnIssues > 0)
    parts.push(`${pluralize(e.priorCommentsOnIssues, "issue comment")}`);
  if (e.priorCommentsOnPRs > 0)
    parts.push(`${pluralize(e.priorCommentsOnPRs, "PR comment")}`);

  return `| Repo history | ${parts.join(" · ")} |`;
}

function renderForensicsRow(f: CommitForensics): string {
  const method: string[] = [];
  if (f.localCommits > 0) method.push(`${f.localCommits} local`);
  if (f.apiCommits > 0) method.push(`${f.apiCommits} via API`);
  const methodStr = method.join(", ");

  const parts = [`${pluralize(f.totalCommits, "commit")} (${methodStr})`];

  if (f.averageDateGapSeconds > 0) {
    parts.push(`avg author/committer gap: ${formatSeconds(f.averageDateGapSeconds)}`);
  } else {
    parts.push("author/committer timestamps identical");
  }

  if (f.signedCommits > 0) {
    parts.push(`${pluralize(f.signedCommits, "signed commit")}`);
  }

  return `| Commits | ${parts.join(" · ")} |`;
}

function renderVelocityRow(v: VelocityAnalysis): string {
  const week = `${pluralize(v.prsLast7Days, "PR")} across ${pluralize(v.uniqueReposLast7Days, "repo")} (7d)`;
  const month = `${pluralize(v.prsLast30Days, "PR")} across ${pluralize(v.uniqueReposLast30Days, "repo")} (30d)`;
  return `| Recent activity | ${week} · ${month} |`;
}

function renderSimilarityRow(s: SimilarityAnalysis): string {
  if (s.referencedIssueNumber === null) {
    const descNote = s.prDescriptionWordCount === 0
      ? "No PR description provided"
      : `PR description: ${pluralize(s.prDescriptionWordCount, "unique word")}`;
    return `| PR description | ${descNote} · no linked issue found |`;
  }

  const parts = [`references #${s.referencedIssueNumber}`];

  if (s.similarityScore !== null) {
    const pct = Math.round(s.similarityScore * 100);
    parts.push(`${pct}% word overlap with issue body`);
  }

  parts.push(`${pluralize(s.prDescriptionWordCount, "unique word")} in description`);

  return `| PR description | ${parts.join(" · ")} |`;
}

export function renderContextCard(
  context: ContributorContext,
  customFooter: string
): string {
  const lines: string[] = [];

  lines.push("### Contributor Context");
  lines.push("");
  lines.push("| | |");
  lines.push("|:--|:--|");

  if (context.account) {
    lines.push(renderAccountRow(context.account));
    lines.push(renderProfileRow(context.account));
  }

  if (context.engagement) {
    lines.push(renderEngagementRow(context.engagement));
  }

  if (context.forensics) {
    lines.push(renderForensicsRow(context.forensics));
  }

  if (context.velocity) {
    lines.push(renderVelocityRow(context.velocity));
  }

  if (context.similarity) {
    lines.push(renderSimilarityRow(context.similarity));
  }

  lines.push("");
  lines.push("---");

  if (customFooter) {
    lines.push(customFooter);
  } else {
    lines.push(
      '<sub>Posted by <a href="https://github.com/dvelton/first-knock">first-knock</a>' +
        " · context for new contributor PRs</sub>"
    );
  }

  return lines.join("\n");
}
