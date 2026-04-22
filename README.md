# first-knock

A GitHub Action that posts a contributor context card when someone new opens a pull request on your repo.

Maintainers spend time clicking through profiles, checking interaction history, and inspecting commits whenever an unfamiliar contributor opens a PR. first-knock does that legwork automatically and posts a summary directly on the PR, so the maintainer can focus on the code.

## What the context card looks like

When a new contributor opens a PR, first-knock posts a comment like this:

> ### Contributor Context
>
> | | |
> |:--|:--|
> | Account | @contributor · created 3 days ago · 1 public repo · 0 followers |
> | Profile | bio: -- · company: -- · location: -- · website: -- · email: yes |
> | Repo history | First interaction with this repository |
> | Commits | 3 commits (2 local, 1 via API) · avg author/committer gap: 45 minutes |
> | Recent activity | 12 PRs across 8 repos (7d) · 45 PRs across 22 repos (30d) |
> | Open PRs | 7 open PRs across 5 public repos (past year, latest 9) · 30d→365d 🟥🟧🟨⚪ (4/2/1/0) |
> | PR description | references #42 · 85% word overlap with issue body · 30 unique words in description |

The card presents facts. It does not score, flag, or make judgments about the contributor.

## Setup

Add a workflow file to your repository at `.github/workflows/contributor-context.yml`:

```yaml
name: Contributor Context

on:
  pull_request:
    types: [opened]

permissions:
  pull-requests: write
  issues: write

jobs:
  context:
    runs-on: ubuntu-latest
    steps:
      - uses: dvelton/first-knock@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

That's it. Organization members and known bot accounts (Dependabot, Renovate, etc.) are skipped by default.

## What it analyzes

first-knock runs five independent analyzers, all enabled by default. Disable any of them with the corresponding input.

**Account** (`enable-account`): Account age, public repositories, followers, and profile completeness (bio, company, location, website, email).

**Repo history** (`enable-engagement`): Whether the contributor has previously opened issues, submitted PRs, or left comments on the repository.

**Commits** (`enable-forensics`): Number of commits in the PR, whether each was authored locally or through the GitHub web/API interface, the gap between author and committer timestamps, and whether commits are signed.

**Recent activity** (`enable-velocity`): How many PRs the contributor has opened across all public repos in the last 7 and 30 days, plus up to the latest 50 open public PRs from the last year summarized with a time-bucket histogram.

**PR description** (`enable-similarity`): Word count of the PR description, whether it references an issue, and if so, the word-level overlap between the PR description and the issue body.

## Challenge-response

Optionally, first-knock can post a follow-up question asking the contributor to describe their change. This is useful for repos that receive a high volume of drive-by PRs.

```yaml
- uses: dvelton/first-knock@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    challenge-enabled: "true"
    challenge-prompt: "Could you share what prompted this change and how you tested it?"
```

When the challenge is enabled, first-knock adds a `needs-response` label to the PR. When the contributor replies, a separate monitor job removes the label and marks the challenge as answered.

To use the monitor, add an `issue_comment` trigger to your workflow:

```yaml
on:
  pull_request:
    types: [opened]
  issue_comment:
    types: [created]

jobs:
  context-card:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: dvelton/first-knock@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          challenge-enabled: "true"

  challenge-monitor:
    if: github.event_name == 'issue_comment'
    runs-on: ubuntu-latest
    steps:
      - uses: dvelton/first-knock@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: challenge-monitor
```

## Auto-close on no response

If you want PRs with unanswered challenges to close automatically after a set number of days, add a scheduled trigger:

```yaml
on:
  pull_request:
    types: [opened]
  issue_comment:
    types: [created]
  schedule:
    - cron: "0 9 * * *"

jobs:
  # ... context-card and challenge-monitor jobs from above ...

  stale-challenges:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: dvelton/first-knock@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: challenge-monitor
          challenge-auto-close-days: "7"
```

The auto-close message is friendly and tells the contributor they can reopen the PR by responding to the question.

## Inputs

| Input | Default | Description |
|---|---|---|
| `github-token` | `${{ github.token }}` | GitHub token for API access |
| `mode` | `context-card` | `context-card` or `challenge-monitor` |
| `enable-account` | `true` | Account profile analysis |
| `enable-engagement` | `true` | Prior repo interaction analysis |
| `enable-forensics` | `true` | Commit metadata analysis |
| `enable-velocity` | `true` | Cross-repo activity analysis |
| `enable-similarity` | `true` | PR/issue text similarity |
| `challenge-enabled` | `false` | Post a follow-up question |
| `challenge-prompt` | *(see below)* | Custom challenge question text |
| `challenge-auto-close-days` | `0` | Days before auto-closing unanswered PRs (0 = disabled) |
| `challenge-label-no-response` | `needs-response` | Label for PRs with pending challenges |
| `skip-accounts` | *(empty)* | Comma-separated accounts to skip |
| `skip-org-members` | `true` | Skip cards for org members |
| `custom-footer` | *(empty)* | Custom footer replacing the default attribution |

Default challenge prompt: "Thanks for your contribution! To help us review this, could you share what prompted this change and how you verified it works?"

## Outputs

| Output | Description |
|---|---|
| `context-card-posted` | Whether a context card was posted |
| `is-first-interaction` | Whether this is the contributor's first interaction with the repo |
| `account-age-days` | Contributor's account age in days |
| `prs-last-7-days` | PRs opened by the contributor across all repos in the last 7 days |

## Skipped accounts

The following bot accounts are skipped by default. Add more with the `skip-accounts` input.

- dependabot[bot]
- dependabot-preview[bot]
- renovate[bot]
- github-actions[bot]
- greenkeeper[bot]
- snyk-bot
- imgbot[bot]
- allcontributors[bot]
- codecov[bot]
- stale[bot]

## How it works

first-knock uses the GitHub API to gather publicly available data about the PR author. It makes between 4 and 8 API calls per PR depending on which analyzers are enabled. All analyzers run in parallel to minimize execution time.

The context card is posted as a PR comment. A hidden HTML marker (`<!-- first-knock-context-card -->`) prevents duplicate cards if the workflow runs more than once.

The challenge system uses HTML comment markers in the challenge comment body to track state, so no external storage is needed.

## License

MIT
