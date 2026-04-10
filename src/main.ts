import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadConfig } from "./config";
import { ContributorContext } from "./types";
import { analyzeAccount } from "./analyzers/account";
import { analyzeEngagement } from "./analyzers/engagement";
import { analyzeForensics } from "./analyzers/forensics";
import { analyzeVelocity } from "./analyzers/velocity";
import { analyzeSimilarity } from "./analyzers/similarity";
import { renderContextCard } from "./card/renderer";
import {
  postChallenge,
  monitorChallengeResponse,
  checkStaleChallenges,
} from "./challenge/prompt";

const CONTEXT_CARD_MARKER = "<!-- first-knock-context-card -->";

async function isOrgMember(
  octokit: ReturnType<typeof github.getOctokit>,
  org: string,
  username: string
): Promise<boolean> {
  try {
    const response = await octokit.rest.orgs.checkMembershipForUser({
      org,
      username,
    });
    // 204 = member, 302 = not a member (redirect)
    return (response.status as number) === 204;
  } catch {
    return false;
  }
}

async function hasExistingContextCard(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<boolean> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });

  return comments.some((c) => c.body?.includes(CONTEXT_CARD_MARKER));
}

async function runContextCard(): Promise<void> {
  const config = loadConfig();
  const token = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(token);

  // Set default outputs for early-return paths
  core.setOutput("context-card-posted", "false");
  core.setOutput("is-first-interaction", "unknown");
  core.setOutput("account-age-days", "unknown");
  core.setOutput("prs-last-7-days", "unknown");

  const { pull_request: pr } = github.context.payload;
  if (!pr) {
    core.info("Not a pull request event. Skipping.");
    return;
  }

  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;
  const pullNumber = pr.number;
  const username = pr.user.login;

  // Skip configured accounts
  if (config.skipAccounts.includes(username)) {
    core.info(`Skipping @${username} (in skip list).`);
    return;
  }

  // Skip organization members if configured
  if (config.skipOrgMembers) {
    const isMember = await isOrgMember(octokit, owner, username);
    if (isMember) {
      core.info(`Skipping @${username} (org member).`);
      return;
    }
  }

  // Skip if we already posted a context card on this PR
  const alreadyPosted = await hasExistingContextCard(octokit, owner, repo, pullNumber);
  if (alreadyPosted) {
    core.info("Context card already posted on this PR. Skipping.");
    return;
  }

  core.info(`Analyzing contributor context for @${username} on PR #${pullNumber}...`);

  // Run enabled analyzers in parallel
  const context: ContributorContext = {
    account: null,
    engagement: null,
    forensics: null,
    velocity: null,
    similarity: null,
  };

  const tasks: Promise<void>[] = [];

  if (config.enableAccount) {
    tasks.push(
      analyzeAccount(octokit, username)
        .then((result) => { context.account = result; })
        .catch((err) => core.warning(`Account analysis failed: ${err.message}`))
    );
  }

  if (config.enableEngagement) {
    tasks.push(
      analyzeEngagement(octokit, owner, repo, username)
        .then((result) => { context.engagement = result; })
        .catch((err) => core.warning(`Engagement analysis failed: ${err.message}`))
    );
  }

  if (config.enableForensics) {
    tasks.push(
      analyzeForensics(octokit, owner, repo, pullNumber)
        .then((result) => { context.forensics = result; })
        .catch((err) => core.warning(`Forensics analysis failed: ${err.message}`))
    );
  }

  if (config.enableVelocity) {
    tasks.push(
      analyzeVelocity(octokit, username)
        .then((result) => { context.velocity = result; })
        .catch((err) => core.warning(`Velocity analysis failed: ${err.message}`))
    );
  }

  if (config.enableSimilarity) {
    tasks.push(
      analyzeSimilarity(octokit, owner, repo, pr.body || "")
        .then((result) => { context.similarity = result; })
        .catch((err) => core.warning(`Similarity analysis failed: ${err.message}`))
    );
  }

  await Promise.all(tasks);

  // Render and post the context card
  const card = renderContextCard(context, config.customFooter);
  const body = `${card}\n\n${CONTEXT_CARD_MARKER}`;

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });

  core.info("Context card posted.");

  // Post challenge if enabled
  if (config.challengeEnabled) {
    await postChallenge(
      octokit,
      owner,
      repo,
      pullNumber,
      username,
      config.challengePrompt
    );

    // Add the no-response label so we can track it
    try {
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: pullNumber,
        labels: [config.challengeLabelOnNoResponse],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      core.warning(`Could not add label: ${msg}`);
    }
  }

  // Set outputs
  core.setOutput("context-card-posted", "true");
  core.setOutput("is-first-interaction", String(context.engagement?.firstInteraction ?? "unknown"));
  core.setOutput("account-age-days", String(context.account?.accountAgeDays ?? "unknown"));
  core.setOutput("prs-last-7-days", String(context.velocity?.prsLast7Days ?? "unknown"));
}

async function runChallengeMonitor(): Promise<void> {
  const config = loadConfig();
  const token = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(token);

  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;

  if (github.context.eventName === "issue_comment") {
    const issue = github.context.payload.issue;
    if (!issue?.pull_request) {
      core.info("Comment is not on a PR. Skipping.");
      return;
    }

    const prAuthor = issue.user.login;
    const commentAuthor = github.context.payload.comment?.user?.login || "";

    await monitorChallengeResponse(
      octokit,
      owner,
      repo,
      issue.number,
      commentAuthor,
      prAuthor,
      config.challengeLabelOnNoResponse
    );
  } else if (github.context.eventName === "schedule") {
    await checkStaleChallenges(
      octokit,
      owner,
      repo,
      config.challengeAutoCloseDays,
      config.challengeLabelOnNoResponse
    );
  } else {
    core.info(`Unexpected event "${github.context.eventName}" for challenge-monitor mode.`);
  }
}

async function run(): Promise<void> {
  try {
    const mode = core.getInput("mode") || "context-card";

    if (mode === "context-card") {
      await runContextCard();
    } else if (mode === "challenge-monitor") {
      await runChallengeMonitor();
    } else {
      core.setFailed(`Unknown mode: ${mode}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

run();
