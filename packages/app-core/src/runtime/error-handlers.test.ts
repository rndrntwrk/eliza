import { describe, expect, it } from "vitest";
import {
  describeNonFatalUnhandledRejection,
  shouldIgnoreUnhandledRejection,
} from "./error-handlers";

describe("runtime error handlers", () => {
  it("treats AI SDK no-output stream failures as nonfatal", () => {
    const cause = new Error("Invalid prompt: prompt or messages must be defined");
    const err = new Error("No output generated. Check the stream for errors.");
    err.name = "AI_NoOutputGeneratedError";
    (err as Error & { cause?: unknown }).cause = cause;

    expect(shouldIgnoreUnhandledRejection(err)).toBe(true);
    expect(describeNonFatalUnhandledRejection(err)).toMatch(
      /provider request failed/i,
    );
  });

  it("does not suppress unrelated unhandled rejections", () => {
    const err = new Error("database migration failed");

    expect(shouldIgnoreUnhandledRejection(err)).toBe(false);
    expect(describeNonFatalUnhandledRejection(err)).toBeNull();
  });
});
