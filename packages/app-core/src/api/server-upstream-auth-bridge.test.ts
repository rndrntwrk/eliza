import http from "node:http";
import { Socket } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bridgeSessionAuthToUpstream,
  shouldBridgeSessionAuthToUpstream,
} from "./server-upstream-auth-bridge";
import type { CompatRuntimeState } from "./compat-route-shared";

const authMocks = vi.hoisted(() => ({
  ensureRouteAuthorized: vi.fn(),
  getProvidedApiToken: vi.fn(),
}));

vi.mock("@elizaos/shared", () => ({
  resolveApiToken: (env: NodeJS.ProcessEnv) => env.ELIZA_API_TOKEN ?? null,
}));

vi.mock("./auth", () => ({
  ensureRouteAuthorized: authMocks.ensureRouteAuthorized,
  getProvidedApiToken: authMocks.getProvidedApiToken,
}));

function fakeReq(opts: {
  method: string;
  pathname: string;
  authorization?: string;
}): http.IncomingMessage {
  const req = new http.IncomingMessage(new Socket());
  req.method = opts.method;
  req.url = opts.pathname;
  req.headers = {};
  if (opts.authorization) req.headers.authorization = opts.authorization;
  Object.defineProperty(req.socket, "remoteAddress", {
    value: "203.0.113.7",
    configurable: true,
  });
  return req;
}

function fakeRes(): http.ServerResponse {
  const req = new http.IncomingMessage(new Socket());
  const res = new http.ServerResponse(req);
  res.statusCode = 200;
  res.end = (() => res) as typeof res.end;
  return res;
}

const STATE = {
  current: { adapter: { db: {} } },
  pendingAgentName: null,
  pendingRestartReasons: [],
} as unknown as CompatRuntimeState;

describe("server upstream auth bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELIZA_API_TOKEN = "internal-upstream-token";
  });

  it("classifies only upstream route families for session auth bridging", () => {
    expect(shouldBridgeSessionAuthToUpstream("GET", "/api/conversations")).toBe(
      true,
    );
    expect(shouldBridgeSessionAuthToUpstream("GET", "/api/stream/status")).toBe(
      true,
    );
    expect(shouldBridgeSessionAuthToUpstream("GET", "/api/auth/me")).toBe(
      false,
    );
    expect(shouldBridgeSessionAuthToUpstream("OPTIONS", "/api/status")).toBe(
      false,
    );
  });

  it("bridges an app-core-authorized browser session into upstream auth", async () => {
    authMocks.getProvidedApiToken.mockReturnValue(null);
    authMocks.ensureRouteAuthorized.mockResolvedValue(true);
    const req = fakeReq({
      method: "GET",
      pathname: "/api/conversations",
    });

    await expect(
      bridgeSessionAuthToUpstream(req, fakeRes(), STATE, "/api/conversations"),
    ).resolves.toBe(true);

    expect(authMocks.ensureRouteAuthorized).toHaveBeenCalledTimes(1);
    expect(req.headers.authorization).toBe("Bearer internal-upstream-token");
    expect(req.headers["x-api-key"]).toBe("internal-upstream-token");
  });

  it("does not forward denied session requests to upstream", async () => {
    authMocks.getProvidedApiToken.mockReturnValue(null);
    authMocks.ensureRouteAuthorized.mockResolvedValue(false);
    const req = fakeReq({
      method: "POST",
      pathname: "/api/conversations",
    });

    await expect(
      bridgeSessionAuthToUpstream(req, fakeRes(), STATE, "/api/conversations"),
    ).resolves.toBe(false);

    expect(req.headers.authorization).toBeUndefined();
    expect(req.headers["x-api-key"]).toBeUndefined();
  });

  it("replaces a machine session bearer with the upstream internal token", async () => {
    authMocks.getProvidedApiToken.mockReturnValue("machine-session-token");
    authMocks.ensureRouteAuthorized.mockResolvedValue(true);
    const req = fakeReq({
      method: "GET",
      pathname: "/api/stream/status",
      authorization: "Bearer machine-session-token",
    });

    await expect(
      bridgeSessionAuthToUpstream(req, fakeRes(), STATE, "/api/stream/status"),
    ).resolves.toBe(true);

    expect(req.headers.authorization).toBe("Bearer internal-upstream-token");
    expect(req.headers["x-api-key"]).toBe("internal-upstream-token");
  });

  it("leaves existing static-token requests alone", async () => {
    authMocks.getProvidedApiToken.mockReturnValue("internal-upstream-token");
    const req = fakeReq({
      method: "GET",
      pathname: "/api/status",
      authorization: "Bearer internal-upstream-token",
    });

    await expect(
      bridgeSessionAuthToUpstream(req, fakeRes(), STATE, "/api/status"),
    ).resolves.toBe(true);

    expect(authMocks.ensureRouteAuthorized).not.toHaveBeenCalled();
    expect(req.headers.authorization).toBe("Bearer internal-upstream-token");
  });
});
