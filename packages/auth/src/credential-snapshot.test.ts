import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createCredentialSnapshot,
  hydrateCredentialSnapshot,
  validateCredentialSnapshot,
} from "./credential-snapshot.ts";
import {
  createIsolatedAccountStoragePolicy,
  saveAccount,
  type AccountCredentialRecord,
} from "./account-storage.ts";

let sourceRoot: string;
let targetRoot: string;

function record(id: string): AccountCredentialRecord {
  return {
    id,
    providerId: "openai-codex",
    label: id,
    source: "oauth",
    credentials: {
      access: `access-${id}`,
      refresh: `refresh-${id}`,
      expires: Date.now() + 60_000,
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

beforeEach(() => {
  sourceRoot = mkdtempSync(path.join(tmpdir(), "eliza-snapshot-source-"));
  targetRoot = mkdtempSync(path.join(tmpdir(), "eliza-snapshot-target-"));
});

afterEach(() => {
  rmSync(sourceRoot, { recursive: true, force: true });
  rmSync(targetRoot, { recursive: true, force: true });
});

describe("credential snapshots", () => {
  it("captures only encrypted canonical account files and excludes disposable Codex homes", () => {
    const policy = createIsolatedAccountStoragePolicy(sourceRoot);
    saveAccount(record("alice-primary"), policy);
    const codexHome = path.join(
      sourceRoot,
      "auth",
      "openai-codex",
      "_codex-home",
      "alice-primary",
    );
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(
      path.join(codexHome, "auth.json"),
      JSON.stringify({ tokens: { access_token: "must-not-leave-runtime" } }),
      { mode: 0o600 },
    );

    const snapshot = createCredentialSnapshot({
      stateRoot: sourceRoot,
      providerId: "openai-codex",
    });

    expect(snapshot.schemaVersion).toBe("eliza.credential-snapshot.v1");
    expect(snapshot.providerId).toBe("openai-codex");
    // This is Eliza's reset fence, not the remote durability CAS revision.
    expect(snapshot.storageGeneration).toBe(0);
    expect(snapshot.files.map((file) => file.relativePath)).toEqual([
      "auth/.credential-storage-generation",
      "auth/openai-codex/alice-primary.json",
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("must-not-leave-runtime");

    const envelope = JSON.parse(
      Buffer.from(snapshot.files[1]!.bytesBase64, "base64").toString("utf8"),
    ) as Record<string, unknown>;
    expect(envelope).toEqual({
      schemaVersion: 2,
      ciphertext: expect.any(String),
    });
  });

  it("rejects a legacy plaintext account file before producing a snapshot", () => {
    const providerRoot = path.join(sourceRoot, "auth", "openai-codex");
    fs.mkdirSync(providerRoot, { recursive: true });
    fs.writeFileSync(
      path.join(providerRoot, "alice-primary.json"),
      JSON.stringify(record("alice-primary")),
      { mode: 0o600 },
    );

    expect(() =>
      createCredentialSnapshot({
        stateRoot: sourceRoot,
        providerId: "openai-codex",
      }),
    ).toThrow(
      expect.objectContaining({
        code: "AUTH_CREDENTIAL_SNAPSHOT_UNENCRYPTED_ACCOUNT",
      }),
    );
  });

  it("rejects traversal and digest tampering during validation", () => {
    const policy = createIsolatedAccountStoragePolicy(sourceRoot);
    saveAccount(record("alice-primary"), policy);
    const snapshot = createCredentialSnapshot({
      stateRoot: sourceRoot,
      providerId: "openai-codex",
    });

    const traversal = structuredClone(snapshot);
    traversal.files[1]!.relativePath = "auth/openai-codex/../escape.json";
    expect(() => validateCredentialSnapshot(traversal)).toThrow(
      expect.objectContaining({ code: "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID" }),
    );

    const tampered = structuredClone(snapshot);
    tampered.files[1]!.bytesBase64 = Buffer.from("tampered").toString("base64");
    expect(() => validateCredentialSnapshot(tampered)).toThrow(
      expect.objectContaining({
        code: "AUTH_CREDENTIAL_SNAPSHOT_FILE_DIGEST_INVALID",
      }),
    );
  });

  it("validates every file before changing the target auth root", () => {
    const targetProvider = path.join(targetRoot, "auth", "openai-codex");
    fs.mkdirSync(targetProvider, { recursive: true });
    const sentinel = path.join(targetProvider, "keep.json");
    fs.writeFileSync(sentinel, "target-must-survive", { mode: 0o600 });

    const policy = createIsolatedAccountStoragePolicy(sourceRoot);
    saveAccount(record("alice-primary"), policy);
    const invalid = createCredentialSnapshot({
      stateRoot: sourceRoot,
      providerId: "openai-codex",
    });
    invalid.files[1]!.sha256 = `sha256:${"0".repeat(64)}`;

    expect(() =>
      hydrateCredentialSnapshot({ stateRoot: targetRoot, snapshot: invalid }),
    ).toThrow(
      expect.objectContaining({
        code: "AUTH_CREDENTIAL_SNAPSHOT_FILE_DIGEST_INVALID",
      }),
    );
    expect(fs.readFileSync(sentinel, "utf8")).toBe("target-must-survive");
  });

  it("atomically replaces the managed provider directory and removes stale accounts", () => {
    const sourcePolicy = createIsolatedAccountStoragePolicy(sourceRoot);
    saveAccount(record("alice-primary"), sourcePolicy);
    const snapshot = createCredentialSnapshot({
      stateRoot: sourceRoot,
      providerId: "openai-codex",
    });

    const targetProvider = path.join(targetRoot, "auth", "openai-codex");
    fs.mkdirSync(targetProvider, { recursive: true });
    fs.writeFileSync(path.join(targetProvider, "stale.json"), "stale", {
      mode: 0o600,
    });

    const receipt = hydrateCredentialSnapshot({
      stateRoot: targetRoot,
      snapshot,
    });

    expect(receipt).toEqual({
      storageGeneration: snapshot.storageGeneration,
      snapshotSha256: snapshot.snapshotSha256,
    });
    expect(fs.existsSync(path.join(targetProvider, "stale.json"))).toBe(false);
    expect(
      fs.readFileSync(path.join(targetProvider, "alice-primary.json")),
    ).toEqual(Buffer.from(snapshot.files[1]!.bytesBase64, "base64"));
    expect(
      fs.readFileSync(
        path.join(targetRoot, "auth", ".credential-storage-generation"),
        "utf8",
      ),
    ).toBe(`${snapshot.storageGeneration}\n`);
  });
});
