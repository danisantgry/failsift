import { describe, expect, it } from "vitest";
import { redact } from "../src/redact.js";

describe("redact", () => {
  it("removes common credentials and personal identifiers", () => {
    const source = [
      "Authorization: Bearer token-value-123",
      "api_key=sample-secret-key",
      `ghp_${"A".repeat(36)}`,
      `npm_${"B".repeat(36)}`,
      `AQ.${"C".repeat(36)}`,
      "eyJheader123.eyJpayload456.signature789",
      "https://build-user:build-password@example.test/path",
      "owner@example.com",
      "C:\\Users\\build-user\\project\\index.ts",
      "/Users/build-user/project/index.ts",
      "/home/runner/project/index.ts"
    ].join("\n");

    const result = redact(source);

    expect(result.count).toBeGreaterThanOrEqual(10);
    expect(result.text).not.toContain("sample-secret-key");
    expect(result.text).not.toContain("owner@example.com");
    expect(result.text).not.toContain("build-password");
    expect(result.text).not.toContain("build-user\\project");
    expect(result.text).toContain("[REDACTED:TOKEN]");
    expect(result.text).toContain("C:\\Users\\[REDACTED:USER]");
    expect(result.text).toContain("/Users/[REDACTED:USER]");
  });

  it("leaves ordinary failure messages unchanged", () => {
    expect(redact("TypeError: value is not a function")).toEqual({
      text: "TypeError: value is not a function",
      count: 0
    });
  });
});
