import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElizaConfig } from "../config/config";
import { collectPluginNames } from "./plugin-collector";

vi.mock("@elizaos/shared", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    hasExplicitCanonicalRuntimeConfig: () => false,
    isAndroidMobile: () => process.env.ELIZA_PLATFORM === "android",
    isMobilePlatform: () =>
      process.env.ELIZA_PLATFORM === "android" ||
      process.env.ELIZA_PLATFORM === "ios",
    migrateLegacyRuntimeConfig: () => undefined,
    resolveDeploymentTargetInConfig: () => ({ runtime: "cloud" }),
    resolveElizaCloudTopology: () => ({
      services: { inference: false },
      shouldLoadPlugin: false,
    }),
    resolveServiceRoutingInConfig: () => undefined,
  };
});

const STREAM555_PLUGIN_PACKAGE = "@rndrntwrk/plugin-555stream";
const STREAM_ENV_KEYS = [
  "STREAM555_BASE_URL",
  "STREAM555_AGENT_TOKEN",
  "STREAM555_AGENT_API_KEY",
  "STREAM_API_BEARER_TOKEN",
] as const;

type StreamEnvKey = (typeof STREAM_ENV_KEYS)[number];

let previousStreamEnv: Record<StreamEnvKey, string | undefined>;

function clearStreamEnv() {
  for (const key of STREAM_ENV_KEYS) {
    delete process.env[key];
  }
}

describe("stream555 canonical runtime mapping", () => {
  beforeEach(() => {
    previousStreamEnv = Object.fromEntries(
      STREAM_ENV_KEYS.map((key) => [key, process.env[key]]),
    ) as Record<StreamEnvKey, string | undefined>;
    clearStreamEnv();
  });

  afterEach(() => {
    clearStreamEnv();
    for (const key of STREAM_ENV_KEYS) {
      const value = previousStreamEnv[key];
      if (value !== undefined) process.env[key] = value;
    }
  });

  it("normalizes stream555-canonical in plugins.allow", () => {
    const config = {
      plugins: { allow: ["stream555-canonical"] },
    } as Partial<ElizaConfig> as ElizaConfig;
    const names = collectPluginNames(config);

    expect(names.has(STREAM555_PLUGIN_PACKAGE)).toBe(true);
  });

  it("loads the canonical 555stream package from plugins.entries", () => {
    const config = {
      plugins: {
        entries: { "stream555-canonical": { enabled: true } },
      },
    } as Partial<ElizaConfig> as ElizaConfig;
    const names = collectPluginNames(config);

    expect(names.has(STREAM555_PLUGIN_PACKAGE)).toBe(true);
  });

  it("auto-loads the canonical 555stream package from staging stream env", () => {
    process.env.STREAM555_BASE_URL = "https://stream555.example";
    process.env.STREAM555_AGENT_TOKEN = "static-token";
    const reasons = new Map<string, string>();

    const names = collectPluginNames({} as ElizaConfig, reasons);

    expect(names.has(STREAM555_PLUGIN_PACKAGE)).toBe(true);
    expect(reasons.get(STREAM555_PLUGIN_PACKAGE)).toBe(
      "env: STREAM555_BASE_URL + stream auth",
    );
  });

  it("auto-loads the canonical 555stream package from config env vars", () => {
    const config = {
      env: {
        vars: {
          STREAM555_BASE_URL: "https://stream555.example",
          STREAM_API_BEARER_TOKEN: "static-bearer-token",
        },
      },
    } as Partial<ElizaConfig> as ElizaConfig;

    const names = collectPluginNames(config);

    expect(names.has(STREAM555_PLUGIN_PACKAGE)).toBe(true);
  });

  it("does not auto-load 555stream without stream auth", () => {
    process.env.STREAM555_BASE_URL = "https://stream555.example";

    const names = collectPluginNames({} as ElizaConfig);

    expect(names.has(STREAM555_PLUGIN_PACKAGE)).toBe(false);
  });

  it("honors explicit stream555-canonical disablement when stream env is configured", () => {
    process.env.STREAM555_BASE_URL = "https://stream555.example";
    process.env.STREAM555_AGENT_TOKEN = "static-token";
    const config = {
      plugins: {
        entries: { "stream555-canonical": { enabled: false } },
      },
    } as Partial<ElizaConfig> as ElizaConfig;

    const names = collectPluginNames(config);

    expect(names.has(STREAM555_PLUGIN_PACKAGE)).toBe(false);
  });
});
