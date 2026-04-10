import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "../types";

const CHALLENGE_MARKER_PREFIX = "<!-- first-knock-challenge:";
const PENDING_MARKER = `${CHALLENGE_MARKER_PREFIX}pending -->`;
const RESPONDED_MARKER = `${CHALLENGE_MARKER_PREFIX}responded -->`;

export function buildChallengeComment(
  username: string,
  prompt: string
): string {
  return [
    `@${username} ${prompt}`,
    "",
    PENDING_MARKER,
  ].join("\n");
}

export async function postChallenge(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  username: string,
  prompt: string
): Promise<number> {
  const body = buildChallengeComment(username, prompt);

  const { data: comment } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });

  core.info(`Posted challenge comment #${comment.id}`);
  return comment.id;
}

export async function monitorChallengeResponse(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  commentAuthor: string,
  prAuthor: string,
  labelOnNoResponse: string
): Promise<void> {
  // This runs on issue_comment events. Check if the PR has a pending challenge
  // and whether the PR author has responded.

  const comments = await (octokit as ReturnType<typeof github.getOctokit>).paginate(
    octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    }
  );

  // Find the challenge comment (posted by the GitHub Actions bot)
  const challengeComment = comments.find(
    (c) => c.body?.includes(PENDING_MARKER)
  );

  if (!challengeComment) {
    core.info("No pending challenge found on this PR.");
    return;
  }

  // Check if the PR author has commented after the challenge
  const challengeDate = new Date(challengeComment.created_at);
  const prAuthorResponse = comments.find(
    (c) =>
      c.user?.login === prAuthor &&
      new Date(c.created_at) > challengeDate
  );

  if (prAuthorResponse) {
    core.info(`PR author @${prAuthor} responded to the challenge.`);

    // Update the challenge comment marker to "responded"
    const updatedBody = challengeComment.body!.replace(
      PENDING_MARKER,
      RESPONDED_MARKER
    );
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: challengeComment.id,
      body: updatedBody,
    });

    // Remove the no-response label if it was added
    try {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: labelOnNoResponse,
      });
    } catch {
      // Label might not exist, which is fine
    }

    core.info("Challenge marked as responded.");
  } else {
    core.info(`No response from @${prAuthor} yet.`);
  }
}

export async function checkStaleChallenges(
  octokit: Octokit,
  owner: string,
  repo: string,
  autoCloseDays: number,
  labelOnNoResponse: string
): Promise<void> {
  if (autoCloseDays <= 0) return;

  // Search for open PRs with the no-response label
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    labels: labelOnNoResponse,
    state: "open",
    per_page: 50,
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - autoCloseDays);

  for (const issue of issues) {
    if (!issue.pull_request) continue;

    // Check if the challenge was posted before the cutoff
    const comments = await (octokit as ReturnType<typeof github.getOctokit>).paginate(
      octokit.rest.issues.listComments, {
        owner,
        repo,
        issue_number: issue.number,
        per_page: 100,
      }
    );

    const challengeComment = comments.find(
      (c) => c.body?.includes(PENDING_MARKER)
    );

    if (!challengeComment) continue;

    const challengeDate = new Date(challengeComment.created_at);
    if (challengeDate > cutoff) continue;

    core.info(
      `Closing PR #${issue.number} — no response to challenge after ${autoCloseDays} days.`
    );

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body:
        `This PR is being closed because the contributor context question posted ` +
        `${autoCloseDays} days ago hasn't received a response. ` +
        `If you'd like to continue with this contribution, please reopen the PR and respond to the question above.\n\n` +
        `<!-- first-knock-auto-close -->`,
    });

    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: "closed",
    });
  }
}
