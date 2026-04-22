import { GitHub } from "@actions/github/lib/utils";

export type Octokit = InstanceType<typeof GitHub>;

export interface AccountAnalysis {
  username: string;
  accountAgeDays: number;
  createdAt: string;
  publicRepos: number;
  followers: number;
  following: number;
  profile: ProfileCompleteness;
}

export interface ProfileCompleteness {
  hasBio: boolean;
  hasCompany: boolean;
  hasLocation: boolean;
  hasBlog: boolean;
  hasEmail: boolean;
  filled: number;
  total: number;
}

export interface EngagementAnalysis {
  priorIssues: number;
  priorPullRequests: number;
  priorCommentsOnIssues: number;
  priorCommentsOnPRs: number;
  firstInteraction: boolean;
}

export interface CommitForensics {
  totalCommits: number;
  apiCommits: number;
  localCommits: number;
  averageDateGapSeconds: number;
  maxDateGapSeconds: number;
  signedCommits: number;
}

export interface VelocityAnalysis {
  prsLast7Days: number;
  prsLast30Days: number;
  uniqueReposLast7Days: number;
  uniqueReposLast30Days: number;
  openPublicPrsLastYear: number;
  openPublicReposLastYear: number;
  openPublicPrSampleSize: number;
  openPublicPrBuckets: OpenPrBuckets;
}

export interface OpenPrBuckets {
  last30Days: number;
  days31To90: number;
  days91To180: number;
  days181To365: number;
}

export interface SimilarityAnalysis {
  referencedIssueNumber: number | null;
  similarityScore: number | null;
  prDescriptionWordCount: number;
  issueBodyWordCount: number | null;
}

export interface ContributorContext {
  account: AccountAnalysis | null;
  engagement: EngagementAnalysis | null;
  forensics: CommitForensics | null;
  velocity: VelocityAnalysis | null;
  similarity: SimilarityAnalysis | null;
}

export interface ActionConfig {
  mode: "context-card" | "challenge-monitor";
  enableAccount: boolean;
  enableEngagement: boolean;
  enableForensics: boolean;
  enableVelocity: boolean;
  enableSimilarity: boolean;
  challengeEnabled: boolean;
  challengePrompt: string;
  challengeAutoCloseDays: number;
  challengeLabelOnNoResponse: string;
  skipAccounts: string[];
  skipOrgMembers: boolean;
  customFooter: string;
}

export interface ChallengeState {
  status: "pending" | "responded";
  challengeCommentId: number;
  postedAt: string;
}
