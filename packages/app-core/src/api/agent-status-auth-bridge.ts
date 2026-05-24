import crypto from "node:crypto";
import type http from "node:http";
import { isAuthorized as isAgentApiAuthorized } from "@miladyai/agent/api/server";
import {
  ensureRouteAuthorized,
  getCompatApiToken,
  getProvidedApiToken,
} from "./auth.ts";
import type { CompatRuntimeState } from "./compat-route-shared";

const UPSTREAM_SESSION_AUTH_BRIDGE_PREFIXES = [
  "/api/agent/autonomy",
  "/api/agent/events",
  "/api/agents",
  "/api/alice",
  "/api/apps",
  "/api/browser-workspace",
  "/api/broadcast",
  "/api/catalog",
  "/api/character",
  "/api/cloud",
  "/api/coding-agents",
  "/api/companion",
  "/api/config",
  "/api/connectors",
  "/api/conversations",
  "/api/emote",
  "/api/emotes",
  "/api/inbox",
  "/api/lifeops",
  "/api/logs",
  "/api/onboarding",
  "/api/plugins",
  "/api/security/audit",
  "/api/status",
  "/api/stream",
  "/api/streaming",
  "/api/triggers",
  "/api/wallet",
  "/api/workbench",
  "/v1",
] as const;

function tokenMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function shouldBridgeAgentFallbackAuth(method: string, pathname: string): boolean {
  if (UPSTREAM_SESSION_AUTH_BRIDGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (method === "GET" && pathname === "/api/status") return true;

  if (pathname === "/api/apps/favorites") {
    return method === "GET" || method === "PUT";
  }
  if (
    method === "POST" &&
    (pathname === "/api/apps/favorites/replace" ||
      pathname === "/api/apps/overlay-presence")
  ) {
    return true;
  }
  if (
    method === "GET" &&
    (pathname === "/api/apps/search" ||
      pathname === "/api/apps/installed" ||
      pathname === "/api/apps/runs" ||
      pathname.startsWith("/api/apps/hero/"))
  ) {
    return true;
  }
  if (pathname.startsWith("/api/apps/runs/")) return true;

  if (pathname.startsWith("/api/vincent/")) return true;

  if (
    pathname === "/api/computer-use/approvals" ||
    pathname === "/api/computer-use/approvals/stream"
  ) {
    return method === "GET";
  }
  if (pathname === "/api/computer-use/approval-mode") {
    return method === "POST";
  }
  if (method === "POST" && /^\/api\/computer-use\/approvals\/[^/]+$/.test(pathname)) {
    return true;
  }

  return false;
}

function isPublicAppHeroRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname.startsWith("/api/apps/hero/");
}

function getComputerUseApprovalsStreamToken(
  req: http.IncomingMessage,
  method: string,
  pathname: string,
): string | null {
  if (method !== "GET" || pathname !== "/api/computer-use/approvals/stream") {
    return null;
  }
  return new URL(req.url ?? "/", "http://localhost").searchParams.get("token")?.trim() || null;
}

function restoreAuthorizationHeader(
  req: http.IncomingMessage,
  previousAuthorization: http.IncomingHttpHeaders["authorization"],
): void {
  if (previousAuthorization === undefined) {
    delete req.headers.authorization;
    return;
  }
  req.headers.authorization = previousAuthorization;
}

export async function authorizeAgentStatusFallback(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  state: CompatRuntimeState,
): Promise<boolean> {
  const method = (req.method ?? "GET").toUpperCase();
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (!shouldBridgeAgentFallbackAuth(method, pathname)) return true;
  if (isPublicAppHeroRoute(method, pathname)) return true;

  const token = getCompatApiToken();
  const providedHeader = getProvidedApiToken(req);
  const streamToken = getComputerUseApprovalsStreamToken(req, method, pathname);
  const shouldPromoteStreamToken = Boolean(streamToken && !providedHeader);
  const previousAuthorization = req.headers.authorization;
  if (shouldPromoteStreamToken && streamToken) {
    // EventSource cannot send headers. Promote the query token through the
    // normal bearer path so paired staging auth and the legacy stream guard agree.
    req.headers.authorization = `Bearer ${streamToken}`;
  }

  const provided = providedHeader ?? streamToken;
  if (token && provided && tokenMatches(token, provided)) return true;

  if (isAgentApiAuthorized(req)) return true;

  if (!(await ensureRouteAuthorized(req, res, state))) {
    if (shouldPromoteStreamToken) {
      restoreAuthorizationHeader(req, previousAuthorization);
    }
    return false;
  }

  return true;
}
