import { Octokit, AccountAnalysis } from "../types";

export async function analyzeAccount(
  octokit: Octokit,
  username: string
): Promise<AccountAnalysis> {
  const { data: user } = await octokit.rest.users.getByUsername({ username });

  const createdAt = new Date(user.created_at);
  const now = new Date();
  const ageDays = Math.floor(
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const fields = [
    user.bio,
    user.company,
    user.location,
    user.blog,
    user.email,
  ];
  const filled = fields.filter((f) => f != null && String(f).trim() !== "").length;

  return {
    username,
    accountAgeDays: ageDays,
    createdAt: user.created_at,
    publicRepos: user.public_repos,
    followers: user.followers,
    following: user.following,
    profile: {
      hasBio: Boolean(user.bio),
      hasCompany: Boolean(user.company),
      hasLocation: Boolean(user.location),
      hasBlog: Boolean(user.blog && String(user.blog).trim()),
      hasEmail: Boolean(user.email),
      filled,
      total: 5,
    },
  };
}
