import type { Plugin } from "@elizaos/core";

export const elizaOSCloudPlugin: Plugin = {
  name: "elizaOSCloud",
  description:
    "ElizaOS Cloud browser facade. Node-only routes and services are exported from the node entry.",
};

// Browser-safe stubs for cloud secret helpers — the renderer has no
// sealed-env store. app-core/dist/api/server.js is bundled into the
// browser surface (milady local-mode) and imports these names; in the
// browser they simply have no secrets to surface.
export function getCloudSecret(
  _key: "ELIZAOS_CLOUD_API_KEY" | "ELIZAOS_CLOUD_ENABLED",
): string | undefined {
  return undefined;
}

export function clearCloudSecrets(): void {}

// [milaidy:elizacloud-browser-tts-stubs]
// app-core imports Cloud TTS helpers while Vite bundles the browser/runtime
// surface. The real implementations remain exported by index.node.ts; these
// browser stubs only keep static named imports resolvable.
type CloudTtsEnvLike = Record<string, string | undefined>;

export function __resetCloudBaseUrlCache(): void {}

export function ensureCloudTtsApiKeyAlias(_env?: CloudTtsEnvLike): boolean {
  return false;
}

export function resolveElevenLabsApiKeyForCloudMode(
  _env?: CloudTtsEnvLike,
): string | null {
  return null;
}

export function resolveCloudTtsBaseUrl(env?: CloudTtsEnvLike): string {
  const configured = env?.ELIZAOS_CLOUD_BASE_URL?.trim();
  return configured && configured.length > 0
    ? configured.replace(/\/+$/, "")
    : "https://www.elizacloud.ai/api/v1";
}

export function normalizeCloudSiteUrl(rawUrl?: string): string {
  const candidate = rawUrl?.trim() || "https://www.elizacloud.ai";
  try {
    const parsed = new URL(candidate);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname
      .replace(/\/+$/, "")
      .replace(/\/api\/v1$/, "");
    if (
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "::1" &&
      !parsed.hostname.startsWith("127.")
    ) {
      parsed.protocol = "https:";
      parsed.port = "";
    }
    if (
      parsed.hostname === "elizacloud.ai" ||
      parsed.hostname === "www.elizacloud.ai"
    ) {
      parsed.hostname = "www.elizacloud.ai";
      parsed.pathname = "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return candidate.replace(/\/+$/, "");
  }
}

export async function handleCloudTtsPreviewRoute(
  _req: unknown,
  res?: {
    statusCode?: number;
    setHeader?: (name: string, value: string) => void;
    end?: (body?: string) => void;
  },
): Promise<boolean> {
  if (res) {
    res.statusCode = 501;
    res.setHeader?.("Content-Type", "application/json");
    res.end?.(
      JSON.stringify({
        error: "Cloud TTS preview is only available in the node runtime.",
      }),
    );
  }
  return true;
}

export function mirrorCompatHeaders(_req: {
  headers?: Record<string, unknown>;
}): void {}


export * from "./types";
export default elizaOSCloudPlugin;
