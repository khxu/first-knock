import * as core from "@actions/core";
import { ActionConfig } from "./types";

const DEFAULT_CHALLENGE_PROMPT =
  "Thanks for your contribution! To help us review this, could you share " +
  "what prompted this change and how you verified it works?";

const DEFAULT_SKIP_ACCOUNTS = [
  "dependabot[bot]",
  "dependabot-preview[bot]",
  "renovate[bot]",
  "github-actions[bot]",
  "greenkeeper[bot]",
  "snyk-bot",
  "imgbot[bot]",
  "allcontributors[bot]",
  "codecov[bot]",
  "stale[bot]",
];

export function loadConfig(): ActionConfig {
  const mode = core.getInput("mode") || "context-card";
  if (mode !== "context-card" && mode !== "challenge-monitor") {
    throw new Error(`Invalid mode: ${mode}. Use "context-card" or "challenge-monitor".`);
  }

  const userSkipAccounts = core
    .getInput("skip-accounts")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const skipAccounts = [...DEFAULT_SKIP_ACCOUNTS, ...userSkipAccounts];

  return {
    mode,
    enableAccount: core.getBooleanInput("enable-account", { required: false }) ?? true,
    enableEngagement: core.getBooleanInput("enable-engagement", { required: false }) ?? true,
    enableForensics: core.getBooleanInput("enable-forensics", { required: false }) ?? true,
    enableVelocity: core.getBooleanInput("enable-velocity", { required: false }) ?? true,
    enableSimilarity: core.getBooleanInput("enable-similarity", { required: false }) ?? true,
    challengeEnabled: (core.getInput("challenge-enabled") || "false") === "true",
    challengePrompt: core.getInput("challenge-prompt") || DEFAULT_CHALLENGE_PROMPT,
    challengeAutoCloseDays: parseInt(core.getInput("challenge-auto-close-days") || "0", 10),
    challengeLabelOnNoResponse: core.getInput("challenge-label-no-response") || "needs-response",
    skipAccounts,
    skipOrgMembers: (core.getInput("skip-org-members") || "true") === "true",
    customFooter: core.getInput("custom-footer") || "",
  };
}

export function loadConfigWithDefaults(overrides: Partial<ActionConfig> = {}): ActionConfig {
  return {
    mode: "context-card",
    enableAccount: true,
    enableEngagement: true,
    enableForensics: true,
    enableVelocity: true,
    enableSimilarity: true,
    challengeEnabled: false,
    challengePrompt: DEFAULT_CHALLENGE_PROMPT,
    challengeAutoCloseDays: 0,
    challengeLabelOnNoResponse: "needs-response",
    skipAccounts: DEFAULT_SKIP_ACCOUNTS,
    skipOrgMembers: true,
    customFooter: "",
    ...overrides,
  };
}
