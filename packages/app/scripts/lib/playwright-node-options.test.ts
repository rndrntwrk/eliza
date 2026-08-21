/**
 * Verifies source-conditioned Playwright collection and normal package-export
 * resolution for its pre-capture build subprocesses with pure option helpers.
 */
import { describe, expect, it } from "bun:test";
import {
  withElizaSourceNodeOptions,
  withoutElizaSourceNodeOptions,
} from "./playwright-node-options.mjs";

describe("withElizaSourceNodeOptions", () => {
  it("adds the source condition", () => {
    expect(withElizaSourceNodeOptions(undefined)).toBe(
      "--conditions=eliza-source",
    );
  });

  it("preserves existing options", () => {
    expect(withElizaSourceNodeOptions("--max-old-space-size=4096")).toBe(
      "--max-old-space-size=4096 --conditions=eliza-source",
    );
  });

  it("is idempotent", () => {
    const options = "--trace-warnings --conditions=eliza-source";
    expect(withElizaSourceNodeOptions(options)).toBe(options);
  });
});

describe("withoutElizaSourceNodeOptions", () => {
  it("returns an empty option set when no other options exist", () => {
    expect(withoutElizaSourceNodeOptions(undefined)).toBe("");
    expect(withoutElizaSourceNodeOptions("--conditions=eliza-source")).toBe(
      "",
    );
  });

  it("strips only the source condition from mixed options", () => {
    const options = [
      "--trace-warnings",
      "--conditions=eliza-source",
      "--conditions=development",
      "--max-old-space-size=4096",
    ].join(" ");
    expect(withoutElizaSourceNodeOptions(options)).toBe(
      "--trace-warnings --conditions=development --max-old-space-size=4096",
    );
  });

  it("strips the separated source-condition form", () => {
    expect(
      withoutElizaSourceNodeOptions(
        "--trace-warnings --conditions eliza-source --conditions development",
      ),
    ).toBe("--trace-warnings --conditions development");
  });

  it("removes repeated source conditions without moving other options", () => {
    const options = [
      "--conditions=eliza-source",
      "--trace-warnings",
      "--conditions eliza-source",
      "--conditions=development",
    ].join(" ");
    expect(withoutElizaSourceNodeOptions(options)).toBe(
      "--trace-warnings --conditions=development",
    );
  });

  it("keeps the collector condition while giving builds normal exports", () => {
    const collectorOptions = withElizaSourceNodeOptions(
      "--trace-warnings --conditions=development",
    );
    expect(collectorOptions).toBe(
      "--trace-warnings --conditions=development --conditions=eliza-source",
    );
    expect(withoutElizaSourceNodeOptions(collectorOptions)).toBe(
      "--trace-warnings --conditions=development",
    );
  });
});
