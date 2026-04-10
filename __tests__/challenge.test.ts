jest.mock("@actions/core");

import { buildChallengeComment } from "../src/challenge/prompt";

describe("buildChallengeComment", () => {
  it("includes username mention", () => {
    const comment = buildChallengeComment("testuser", "Please explain your change.");
    expect(comment).toContain("@testuser");
  });

  it("includes the prompt text", () => {
    const prompt = "What prompted this change?";
    const comment = buildChallengeComment("testuser", prompt);
    expect(comment).toContain(prompt);
  });

  it("includes the pending challenge marker", () => {
    const comment = buildChallengeComment("testuser", "Explain your change.");
    expect(comment).toContain("<!-- first-knock-challenge:pending -->");
  });
});
