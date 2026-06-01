import type http from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { MiscRouteContext } from "./misc-routes";
import { handleMiscRoutes } from "./misc-routes";

function makeMiscRouteContext(
  method: string,
  pathname: string,
): {
  ctx: MiscRouteContext;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const error = vi.fn();
  const readJsonBody = vi.fn();

  const ctx = {
    req: {} as http.IncomingMessage,
    res: {} as http.ServerResponse,
    method,
    pathname,
    url: new URL(`http://localhost${pathname}`),
    state: {
      config: {},
      runtime: null,
      agentState: "ready",
      agentName: "Alice",
      shellEnabled: false,
      nextEventId: 1,
      eventBuffer: [],
      shareIngestQueue: [],
      startup: {},
      pendingRestartReasons: [],
    },
    json,
    error,
    readJsonBody,
    AGENT_EVENT_ALLOWED_STREAMS: new Set<string>(),
    resolveTerminalRunRejection: vi.fn(() => null),
    resolveTerminalRunClientId: vi.fn(() => "test-client"),
    isSharedTerminalClientId: vi.fn(() => false),
    activeTerminalRunCount: 0,
    setActiveTerminalRunCount: vi.fn(),
  } as unknown as MiscRouteContext;

  return { ctx, json };
}

describe("handleMiscRoutes emotes", () => {
  it("serves the companion avatar action catalog from a server-safe module", async () => {
    const { ctx, json } = makeMiscRouteContext("GET", "/api/emotes");

    await expect(handleMiscRoutes(ctx)).resolves.toBe(true);

    expect(json).toHaveBeenCalledOnce();
    const payload = json.mock.calls[0]?.[1] as {
      emotes?: Array<{ id?: string; path?: string }>;
    };
    expect(payload.emotes?.length).toBeGreaterThan(0);
    expect(payload.emotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wave",
          path: expect.stringContaining("waving-both-hands"),
        }),
      ]),
    );
  });
});
