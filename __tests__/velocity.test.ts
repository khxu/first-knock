import { analyzeVelocity } from "../src/analyzers/velocity";

function createMockOctokit() {
  return {
    rest: {
      search: {
        issuesAndPullRequests: jest
          .fn()
          .mockImplementation(({ q }: { q: string }) => {
            if (q.includes("created:>=") && q.includes("state:open")) {
              return Promise.resolve({
                data: {
                  total_count: 4,
                  items: [
                    {
                      repository_url: "https://api.github.com/repos/octo/public-one",
                      created_at: "2026-04-20T00:00:00Z",
                    },
                    {
                      repository_url: "https://api.github.com/repos/octo/public-two",
                      created_at: "2026-03-10T00:00:00Z",
                    },
                    {
                      repository_url: "https://api.github.com/repos/octo/private-repo",
                      created_at: "2025-12-01T00:00:00Z",
                    },
                    {
                      repository_url: "https://api.github.com/repos/octo/public-one",
                      created_at: "2025-06-01T00:00:00Z",
                    },
                  ],
                },
              });
            }

            if (q.includes("created:>=2026-04-15")) {
              return Promise.resolve({
                data: {
                  total_count: 2,
                  items: [
                    { repository_url: "https://api.github.com/repos/octo/public-one" },
                    { repository_url: "https://api.github.com/repos/octo/public-two" },
                  ],
                },
              });
            }

            return Promise.resolve({
              data: {
                total_count: 5,
                items: [
                  { repository_url: "https://api.github.com/repos/octo/public-one" },
                  { repository_url: "https://api.github.com/repos/octo/public-two" },
                  { repository_url: "https://api.github.com/repos/octo/public-two" },
                ],
              },
            });
          }),
      },
      repos: {
        get: jest.fn().mockImplementation(({ repo }: { repo: string }) => {
          return Promise.resolve({
            data: {
              private: repo === "private-repo",
            },
          });
        }),
      },
    },
  } as any;
}

describe("analyzeVelocity", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-22T00:00:00Z").getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("includes recent open public PR metrics from the latest public results", async () => {
    const octokit = createMockOctokit();

    const result = await analyzeVelocity(octokit, "octocat");

    expect(result.prsLast7Days).toBe(2);
    expect(result.prsLast30Days).toBe(5);
    expect(result.openPublicPrsLastYear).toBe(3);
    expect(result.openPublicReposLastYear).toBe(2);
    expect(result.openPublicPrSampleSize).toBe(4);
    expect(result.openPublicPrBuckets).toEqual({
      last30Days: 1,
      days31To90: 1,
      days91To180: 0,
      days181To365: 1,
    });
    expect(octokit.rest.repos.get).toHaveBeenCalledTimes(3);
  });
});
