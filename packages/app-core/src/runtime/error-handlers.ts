/**
 * Shared error-formatting utilities for global process handlers.
 * Used by both the CLI (run-main.ts) and the dev-server (dev-server.ts).
 * Intentionally dependency-free — only string operations.
 */

export function formatUncaughtError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function hasInsufficientCreditsSignal(input: string): boolean {
  return /\b(insufficient(?:[_\s]+(?:credits?|quota))|insufficient_quota|out of credits|payment required|statuscode:\s*402)\b/i.test(
    input,
  );
}

function hasProviderNoOutputSignal(input: string): boolean {
  return /AI_NoOutputGeneratedError|No output generated|AI_APICallError|AI_RetryError|AI_InvalidPromptError|Invalid prompt/i.test(
    input,
  );
}

export function describeNonFatalUnhandledRejection(
  reason: unknown,
): string | null {
  const formatted = formatUncaughtError(reason);
  if (!hasProviderNoOutputSignal(formatted)) {
    return null;
  }

  if (hasInsufficientCreditsSignal(formatted)) {
    return "Provider credits appear exhausted; request failed without output. Top up credits and retry.";
  }

  return "Provider request failed without output; request should fail closed without restarting.";
}

/**
 * Returns `true` when the rejection looks like an AI provider stream/generation
 * failure. These are request-scoped failures, so callers should warn instead
 * of restarting the host process.
 */
export function shouldIgnoreUnhandledRejection(reason: unknown): boolean {
  const formatted = formatUncaughtError(reason);
  if (!hasProviderNoOutputSignal(formatted)) {
    return false;
  }

  if (hasInsufficientCreditsSignal(formatted)) {
    return true;
  }

  const seen = new Set<unknown>();
  let current: unknown = reason;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);

    const statusCode = (current as { statusCode?: number }).statusCode;
    if (statusCode === 402) return true;

    const responseBody = (current as { responseBody?: unknown }).responseBody;
    if (
      typeof responseBody === "string" &&
      hasInsufficientCreditsSignal(responseBody)
    ) {
      return true;
    }

    const errors = (current as { errors?: unknown }).errors;
    if (Array.isArray(errors)) {
      for (const inner of errors) {
        if (shouldIgnoreUnhandledRejection(inner)) return true;
      }
    }

    current = (current as { cause?: unknown }).cause;
  }

  return true;
}
