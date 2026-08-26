/**
 * Full-resolver regressions for synthetic admission of filesystem-discovered
 * plugins. Temporary package fixtures write an import marker so denial must
 * happen before executable plugin code is evaluated.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ElizaError } from "@elizaos/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ElizaConfig } from "../config/config.ts";
import { resolvePlugins } from "./plugin-resolver.ts";

const ENV_KEYS = [
  "ELIZA_SYNTHETIC_MODE",
  "ELIZA_SYNTHETIC_PLUGIN_ALLOWLIST",
  "ELIZA_STATE_DIR",
  "ELIZA_PLATFORM",
  "ELIZA_LOCAL_LLAMA",
  "ELIZAOS_CLOUD_API_KEY",
  "ELIZAOS_CLOUD_ENABLED",
  "ELIZA_SKIP_PLUGINS",
  "ELIZA_DISABLE_WORKSPACE_PLUGIN_OVERRIDES",
] as const;

let savedEnv: Record<string, string | undefined>;
let tempDirs: string[];

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.ELIZA_DISABLE_WORKSPACE_PLUGIN_OVERRIDES = "1";
  tempDirs = [];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeFilesystemPlugin(params: {
  parentDir: string;
  packageName: string;
  markerPath: string;
}): void {
  const packageDir = path.join(params.parentDir, "fixture-plugin");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: params.packageName,
        version: "1.0.0",
        type: "module",
        main: "./index.js",
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    path.join(packageDir, "index.js"),
    [
      'import { writeFileSync } from "node:fs";',
      `writeFileSync(${JSON.stringify(params.markerPath)}, "imported\\n");`,
      `export default { name: ${JSON.stringify(params.packageName)}, description: "synthetic filesystem admission fixture", actions: [] };`,
      "",
    ].join("\n"),
  );
}

async function allowCurrentResolverBaseline(config: ElizaConfig): Promise<void> {
  process.env.ELIZA_SYNTHETIC_PLUGIN_ALLOWLIST = "";
  let thrown: unknown;
  try {
    await resolvePlugins(config, { quiet: true });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(ElizaError);
  const admissionError = thrown as ElizaError;
  expect(admissionError.code).toBe("SYNTHETIC_ADMISSION_DENIED");
  const context = admissionError.context as {
    denials: Array<{ packageName: string }>;
  };
  process.env.ELIZA_SYNTHETIC_PLUGIN_ALLOWLIST = context.denials
    .map((denial) => denial.packageName)
    .join(",");
}

async function expectFilesystemPluginDenied(params: {
  config: ElizaConfig;
  packageName: string;
  markerPath: string;
  expectedProvenance: string;
  stateDir: string;
}): Promise<void> {
  let thrown: unknown;
  try {
    await resolvePlugins(params.config, { quiet: true });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(ElizaError);
  const admissionError = thrown as ElizaError;
  expect(admissionError.code).toBe("SYNTHETIC_ADMISSION_DENIED");
  const context = admissionError.context as {
    denials: Array<{ packageName: string; provenance: string }>;
  };
  expect(context.denials).toContainEqual({
    packageName: params.packageName,
    provenance: params.expectedProvenance,
  });
  expect(existsSync(params.markerPath)).toBe(false);

  const ledger = JSON.parse(
    readFileSync(
      path.join(params.stateDir, "synthetic-admission-denials.json"),
      "utf8",
    ),
  ) as {
    denials: Array<{ packageName: string; provenance: string }>;
  };
  expect(ledger.denials).toContainEqual({
    packageName: params.packageName,
    provenance: params.expectedProvenance,
  });
}

describe("filesystem-discovered plugins pass through final synthetic admission", () => {
  it.each([
    {
      label: "ejected directory",
      packageName: "@synthetic-test/plugin-ejected",
      expectedProvenance: "ejected plugins dir",
      source: "ejected" as const,
    },
    {
      label: "custom directory",
      packageName: "@synthetic-test/plugin-custom",
      expectedProvenance: "plugins/custom",
      source: "custom" as const,
    },
    {
      label: "configured load path",
      packageName: "@synthetic-test/plugin-load-path",
      expectedProvenance: "plugins.load.paths[0]",
      source: "load-path" as const,
    },
  ])(
    "denies an undeclared plugin from the $label before import",
    async ({ packageName, expectedProvenance, source }) => {
      const stateDir = makeTempDir("synthetic-filesystem-state-");
      const externalDir = makeTempDir("synthetic-filesystem-external-");
      const markerPath = path.join(stateDir, `${source}-imported`);
      process.env.ELIZA_STATE_DIR = stateDir;
      process.env.ELIZA_SYNTHETIC_MODE = "1";

      const config = {
        plugins: {
          entries: {},
          ...(source === "load-path"
            ? { load: { paths: [externalDir] } }
            : {}),
        },
      } as unknown as ElizaConfig;
      await allowCurrentResolverBaseline(config);

      const parentDir =
        source === "ejected"
          ? path.join(stateDir, "plugins/ejected")
          : source === "custom"
            ? path.join(stateDir, "plugins/custom")
            : externalDir;
      writeFilesystemPlugin({ parentDir, packageName, markerPath });

      await expectFilesystemPluginDenied({
        config,
        packageName,
        markerPath,
        expectedProvenance,
        stateDir,
      });
    },
  );

  it("imports a filesystem plugin only when the composition declares it", async () => {
    const stateDir = makeTempDir("synthetic-filesystem-allow-state-");
    const markerPath = path.join(stateDir, "allowlisted-imported");
    const packageName = "@synthetic-test/plugin-allowlisted";
    process.env.ELIZA_STATE_DIR = stateDir;
    process.env.ELIZA_SYNTHETIC_MODE = "1";

    const config = {
      plugins: { entries: {} },
    } as unknown as ElizaConfig;
    await allowCurrentResolverBaseline(config);
    writeFilesystemPlugin({
      parentDir: path.join(stateDir, "plugins/custom"),
      packageName,
      markerPath,
    });
    process.env.ELIZA_SYNTHETIC_PLUGIN_ALLOWLIST = [
      process.env.ELIZA_SYNTHETIC_PLUGIN_ALLOWLIST,
      packageName,
    ]
      .filter(Boolean)
      .join(",");

    const resolved = await resolvePlugins(config, { quiet: true });
    expect(resolved.some((plugin) => plugin.name === packageName)).toBe(true);
    expect(readFileSync(markerPath, "utf8")).toBe("imported\n");
  });

  it("preserves ordinary filesystem discovery outside synthetic mode", async () => {
    const stateDir = makeTempDir("filesystem-nonsynthetic-state-");
    const markerPath = path.join(stateDir, "nonsynthetic-imported");
    const packageName = "@synthetic-test/plugin-nonsynthetic";
    process.env.ELIZA_STATE_DIR = stateDir;
    writeFilesystemPlugin({
      parentDir: path.join(stateDir, "plugins/custom"),
      packageName,
      markerPath,
    });

    const resolved = await resolvePlugins(
      { plugins: { entries: {} } } as unknown as ElizaConfig,
      { quiet: true },
    );
    expect(resolved.some((plugin) => plugin.name === packageName)).toBe(true);
    expect(readFileSync(markerPath, "utf8")).toBe("imported\n");
  });
});
