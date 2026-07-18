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

  it("ignores GitHub group labels and echoed shell source while keeping command output", () => {
    const lines = normalize([
      "2026-07-18T12:00:00Z ##[group]Run echo \"Error: misleading command text\"",
      "2026-07-18T12:00:01Z \u001b[36;1mecho \"Error: misleading command text\"\u001b[0m",
      "2026-07-18T12:00:02Z Error: actual command output",
      "2026-07-18T12:00:03Z ##[endgroup]"
    ].join("\n"));
    expect(lines).toEqual([
      { number: 1, text: "" },
      { number: 2, text: "" },
      { number: 3, text: "Error: actual command output" },
      { number: 4, text: "" }
    ]);
  });
});
