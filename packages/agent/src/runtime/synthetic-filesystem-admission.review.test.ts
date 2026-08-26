/**
 * Adversarial exact-head review controls for synthetic admission of plugins
 * discovered after the normal collector. Real temporary packages write an
 * import marker, so a denied package must be rejected before module evaluation.
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
] as const;

let savedEnv: Record<string, string | undefined>;
let tempDirs: string[];

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
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

function makeConfig(loadPath?: string): ElizaConfig {
  return {
    plugins: {
      entries: {},
      ...(loadPath ? { load: { paths: [loadPath] } } : {}),
    },
  } as unknown as ElizaConfig;
}

function writeExecutablePlugin(params: {
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
      `export default { name: ${JSON.stringify(params.packageName)}, description: "review fixture", actions: [] };`,
      "",
    ].join("\n"),
  );
}

async function admitCurrentBaseline(config: ElizaConfig): Promise<string[]> {
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
  const baseline = context.denials.map((denial) => denial.packageName);
  process.env.ELIZA_SYNTHETIC_PLUGIN_ALLOWLIST = baseline.join(",");
  return baseline;
}

async function expectDeniedBeforeImport(params: {
  config: ElizaConfig;
  packageName: string;
  markerPath: string;
  provenance: string;
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
    provenance: params.provenance,
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
    provenance: params.provenance,
  });
}

describe("exact-head filesystem synthetic admission", () => {
  it.each([
    {
      label: "ejected directory",
      source: "ejected" as const,
      packageName: "@synthetic-review/plugin-ejected",
      provenance: "ejected plugins dir",
    },
    {
      label: "custom directory",
      source: "custom" as const,
      packageName: "@synthetic-review/plugin-custom",
      provenance: "custom plugins dir",
    },
    {
      label: "configured load path",
      source: "load-path" as const,
      packageName: "@synthetic-review/plugin-load-path",
      provenance: "custom plugins dir",
    },
  ])(
    "denies an undeclared executable package from the $label before import",
    async ({ source, packageName, provenance }) => {
      const stateDir = makeTempDir("synthetic-review-state-");
      const externalDir = makeTempDir("synthetic-review-external-");
      const markerPath = path.join(stateDir, `${source}-imported`);
      process.env.ELIZA_STATE_DIR = stateDir;
      process.env.ELIZA_SYNTHETIC_MODE = "1";

      const config = makeConfig(
        source === "load-path" ? externalDir : undefined,
      );
      await admitCurrentBaseline(config);

      const parentDir =
        source === "ejected"
          ? path.join(stateDir, "plugins/ejected")
          : source === "custom"
            ? path.join(stateDir, "plugins/custom")
            : externalDir;
      writeExecutablePlugin({ parentDir, packageName, markerPath });

      await expectDeniedBeforeImport({
        config,
        packageName,
        markerPath,
        provenance,
        stateDir,
      });
    },
  );

  it("imports a filesystem package only after explicit synthetic admission", async () => {
    const stateDir = makeTempDir("synthetic-review-allow-state-");
    const markerPath = path.join(stateDir, "allowlisted-imported");
    const packageName = "@synthetic-review/plugin-allowlisted";
    process.env.ELIZA_STATE_DIR = stateDir;
    process.env.ELIZA_SYNTHETIC_MODE = "1";

    const config = makeConfig();
    const baseline = await admitCurrentBaseline(config);
    writeExecutablePlugin({
      parentDir: path.join(stateDir, "plugins/custom"),
      packageName,
      markerPath,
    });
    process.env.ELIZA_SYNTHETIC_PLUGIN_ALLOWLIST = [
      ...baseline,
      packageName,
    ].join(",");

    const resolved = await resolvePlugins(config, { quiet: true });
    expect(resolved.some((plugin) => plugin.name === packageName)).toBe(true);
    expect(readFileSync(markerPath, "utf8")).toBe("imported\n");
  });

  it("preserves ordinary filesystem discovery when synthetic mode is inactive", async () => {
    const stateDir = makeTempDir("synthetic-review-normal-state-");
    const markerPath = path.join(stateDir, "normal-imported");
    const packageName = "@synthetic-review/plugin-normal";
    process.env.ELIZA_STATE_DIR = stateDir;
    writeExecutablePlugin({
      parentDir: path.join(stateDir, "plugins/custom"),
      packageName,
      markerPath,
    });

    const resolved = await resolvePlugins(makeConfig(), { quiet: true });
    expect(resolved.some((plugin) => plugin.name === packageName)).toBe(true);
    expect(readFileSync(markerPath, "utf8")).toBe("imported\n");
  });
});
