/** Covers fail-closed parsing of CDN validation retry-policy overrides. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { getValidationRetryPolicy, main } from "./validate-cdn-assets.mjs";

const SCRIPT = fileURLToPath(
  new URL("./validate-cdn-assets.mjs", import.meta.url),
);

describe("validate-cdn-assets retry policy", () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeTempDir() {
    const dir = mkdtempSync(path.join(tmpdir(), "eliza-cdn-policy-"));
    tempDirs.push(dir);
    return dir;
  }

  it("preserves local and CI defaults plus valid explicit overrides", () => {
    expect(getValidationRetryPolicy({ env: {} })).toEqual({
      attempts: 1,
      delayMs: 0,
      concurrency: 2,
    });
    expect(getValidationRetryPolicy({ env: { CI: "true" } })).toEqual({
      attempts: 3,
      delayMs: 5000,
      concurrency: 4,
    });
    expect(
      getValidationRetryPolicy({
        env: {
          CI: "true",
          ELIZA_CDN_VALIDATE_ATTEMPTS: "",
          ELIZA_CDN_VALIDATE_DELAY_MS: "",
          ELIZA_CDN_VALIDATE_CONCURRENCY: "",
        },
      }),
    ).toEqual({ attempts: 3, delayMs: 5000, concurrency: 4 });
    expect(
      getValidationRetryPolicy({
        env: {
          ELIZA_CDN_VALIDATE_ATTEMPTS: "05",
          ELIZA_CDN_VALIDATE_DELAY_MS: "0",
          ELIZA_CDN_VALIDATE_CONCURRENCY: "7",
        },
      }),
    ).toEqual({ attempts: 5, delayMs: 0, concurrency: 7 });
  });

  it.each([
    ["ELIZA_CDN_VALIDATE_ATTEMPTS", "1junk"],
    ["ELIZA_CDN_VALIDATE_ATTEMPTS", "1.5"],
    ["ELIZA_CDN_VALIDATE_ATTEMPTS", "+1"],
    ["ELIZA_CDN_VALIDATE_ATTEMPTS", "-1"],
    ["ELIZA_CDN_VALIDATE_ATTEMPTS", " "],
    ["ELIZA_CDN_VALIDATE_ATTEMPTS", "0"],
    ["ELIZA_CDN_VALIDATE_ATTEMPTS", "9007199254740992"],
    ["ELIZA_CDN_VALIDATE_DELAY_MS", "1junk"],
    ["ELIZA_CDN_VALIDATE_DELAY_MS", "1.5"],
    ["ELIZA_CDN_VALIDATE_DELAY_MS", "+1"],
    ["ELIZA_CDN_VALIDATE_DELAY_MS", "-1"],
    ["ELIZA_CDN_VALIDATE_DELAY_MS", " "],
    ["ELIZA_CDN_VALIDATE_DELAY_MS", "9007199254740992"],
    ["ELIZA_CDN_VALIDATE_CONCURRENCY", "1junk"],
    ["ELIZA_CDN_VALIDATE_CONCURRENCY", "1.5"],
    ["ELIZA_CDN_VALIDATE_CONCURRENCY", "+1"],
    ["ELIZA_CDN_VALIDATE_CONCURRENCY", "-1"],
    ["ELIZA_CDN_VALIDATE_CONCURRENCY", " "],
    ["ELIZA_CDN_VALIDATE_CONCURRENCY", "0"],
    ["ELIZA_CDN_VALIDATE_CONCURRENCY", "9007199254740992"],
  ])("rejects malformed %s=%s", (key, value) => {
    expect(() => getValidationRetryPolicy({ env: { [key]: value } })).toThrow(
      new RegExp(`^${key} must be `),
    );
  });

  it("validates an injected main environment before inspecting its root", async () => {
    const cwd = makeTempDir();
    await expect(
      main({
        cwd,
        env: {
          GITHUB_SHA: "e11f20c5ef45a66fb5b8411cb6c8bab5e7208b88",
          ELIZA_CDN_VALIDATE_ATTEMPTS: "1junk",
        },
      }),
    ).rejects.toThrow(
      "ELIZA_CDN_VALIDATE_ATTEMPTS must be a positive safe integer",
    );
  });

  it("fails the real CLI at the policy boundary before manifest inspection", () => {
    const cwd = makeTempDir();
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_SHA: "e11f20c5ef45a66fb5b8411cb6c8bab5e7208b88",
        ELIZA_CDN_ROOT_DIR: cwd,
        ELIZA_CDN_VALIDATE_ATTEMPTS: "1junk",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "ELIZA_CDN_VALIDATE_ATTEMPTS must be a positive safe integer",
    );
    expect(result.stderr).not.toContain("Static asset manifest");
  });
});
