import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { InputError } from "../src/errors.js";
import { measureInput, readInput, readStreamLimited, resolveLimits } from "../src/input.js";

describe("input limits", () => {
  it("reads streams within limits", async () => {
    const result = await readStreamLimited(Readable.from(["one\n", "two"]), { maxBytes: 20, maxLines: 3 });
    expect(result).toBe("one\ntwo");
  });

  it("rejects oversized byte and line inputs", async () => {
    await expect(readStreamLimited(Readable.from(["too large"]), { maxBytes: 3, maxLines: 2 }))
      .rejects.toBeInstanceOf(InputError);
    expect(() => measureInput("one\ntwo\nthree", { maxBytes: 100, maxLines: 2 }))
      .toThrow(/line limit/u);
  });

  it("validates limits and missing files", async () => {
    expect(() => resolveLimits({ maxBytes: 0 })).toThrow(/positive integer/u);
    expect(() => resolveLimits({ maxLines: -1 })).toThrow(/positive integer/u);
    await expect(readInput("definitely-missing-failsift.log", resolveLimits()))
      .rejects.toThrow(/Cannot read input file/u);
  });

  it("reads files and rejects directories or oversized files", async () => {
    const directory = join(tmpdir(), `failsift-input-${process.pid}`);
    const file = join(directory, "sample.txt");
    await mkdir(directory, { recursive: true });
    await writeFile(file, "small input", "utf8");
    await expect(readInput(file, { maxBytes: 20, maxLines: 2 })).resolves.toBe("small input");
    await expect(readInput(directory, { maxBytes: 20, maxLines: 2 })).rejects.toThrow(/not a file/u);
    await expect(readInput(file, { maxBytes: 2, maxLines: 2 })).rejects.toThrow(/size limit/u);
  });

  it("rejects byte limits during direct measurement", () => {
    expect(() => measureInput("four", { maxBytes: 3, maxLines: 2 })).toThrow(/size limit/u);
    expect(resolveLimits()).toMatchObject({ maxBytes: 50 * 1024 * 1024, maxLines: 200_000 });
  });

  it("measures empty input", () => {
    expect(measureInput("", { maxBytes: 10, maxLines: 10 })).toMatchObject({ bytesRead: 0, linesRead: 0 });
  });
});
