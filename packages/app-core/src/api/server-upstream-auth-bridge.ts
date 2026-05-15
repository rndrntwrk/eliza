import crypto from "node:crypto";
import type http from "node:http";
import { resolveApiToken } from "@elizaos/shared";
import { ensureRouteAuthorized, getProvidedApiToken } from "./auth";
import type { CompatRuntimeState } from "./compat-route-shared";

const UPSTREAM_SESSION_AUTH_BRIDGE_PREFIXES = [
  "/api/agent/events",
  "/api/agents",
  "/api/broadcast",
  "/api/coding-agents",
  "/api/companion",
  "/api/conversations",
  "/api/logs",
  "/api/security/audit",
  "/api/status",
  "/api/stream",
  "/api/streaming",
  "/v1",
] as const;

function tokenMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function shouldBridgeSessionAuthToUpstream(
  method: string | undefined,
  pathname: string,
): boolean {
  if ((method ?? "GET").toUpperCase() === "OPTIONS") return false;
  return UPSTREAM_SESSION_AUTH_BRIDGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function bridgeSessionAuthToUpstream(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  state: CompatRuntimeState,
  pathname: string,
): Promise<boolean> {
  if (!shouldBridgeSessionAuthToUpstream(req.method, pathname)) return true;

  const upstreamToken = resolveApiToken(process.env);
  if (!upstreamToken) return true;

  const provided = getProvidedApiToken(req);
  if (provided && tokenMatches(upstreamToken, provided)) return true;

  if (!(await ensureRouteAuthorized(req, res, state))) {
    return false;
  }

  req.headers.authorization = `Bearer ${upstreamToken}`;
  req.headers["x-api-key"] = upstreamToken;
  return true;
}
