import { describe, expect, it } from "vitest";
import { normalize } from "../src/normalize.js";

describe("normalize", () => {
  it("removes ANSI, timestamps, and GitHub command prefixes", () => {
    const [line] = normalize("2026-07-10T12:00:00.000Z \u001b[31m##[error]Failure\u001b[0m   ");
    expect(line).toEqual({ number: 1, text: "[error] Failure" });
  });

  it("preserves source line numbers", () => {
    expect(normalize("first\nsecond")).toEqual([
      { number: 1, text: "first" },
      { number: 2, text: "second" }
    ]);
  });
});
