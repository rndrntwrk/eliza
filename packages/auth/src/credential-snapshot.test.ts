import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type AccountCredentialRecord,
  createIsolatedAccountStoragePolicy,
  saveAccount,
} from "./account-storage.ts";
import {
  type CredentialSnapshotFileV1,
  type CredentialSnapshotV1,
  createCredentialSnapshot,
  hydrateCredentialSnapshot,
  validateCredentialSnapshot,
} from "./credential-snapshot.ts";

const ACCOUNT_RELATIVE_PATH = "auth/openai-codex/alice-primary.json";
const METADATA_RELATIVE_PATH = "auth/_pool-metadata.json";

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

function requireSnapshotFile(
  snapshot: CredentialSnapshotV1,
  relativePath: string,
): CredentialSnapshotFileV1 {
  const file = snapshot.files.find(
    (candidate) => candidate.relativePath === relativePath,
  );
  if (!file) throw new Error(`Snapshot is missing ${relativePath}`);
  return file;
}

function writePoolMetadata(root: string, value: unknown): Buffer {
  const authRoot = path.join(root, "auth");
  fs.mkdirSync(authRoot, { recursive: true, mode: 0o700 });
  const bytes = Buffer.from(JSON.stringify(value, null, 2), "utf8");
  fs.writeFileSync(path.join(authRoot, "_pool-metadata.json"), bytes, {
    mode: 0o600,
  });
  return bytes;
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
  it("captures encrypted accounts and pool routing metadata but excludes disposable Codex homes", () => {
    const policy = createIsolatedAccountStoragePolicy(sourceRoot);
    saveAccount(record("alice-primary"), policy);
    const metadataBytes = writePoolMetadata(sourceRoot, {
      "openai-codex": {
        "alice-primary": {
          enabled: true,
          health: "ok",
          label: "Primary",
          priority: 0,
        },
      },
    });
    const codexHome = path.join(
      sourceRoot,
      "auth",
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
      METADATA_RELATIVE_PATH,
      ACCOUNT_RELATIVE_PATH,
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("must-not-leave-runtime");

    const accountFile = requireSnapshotFile(snapshot, ACCOUNT_RELATIVE_PATH);
    const envelope = JSON.parse(
      Buffer.from(accountFile.bytesBase64, "base64").toString("utf8"),
    ) as Record<string, unknown>;
    expect(envelope).toEqual({
      schemaVersion: 2,
      ciphertext: expect.any(String),
    });

    const metadataFile = requireSnapshotFile(snapshot, METADATA_RELATIVE_PATH);
    expect(Buffer.from(metadataFile.bytesBase64, "base64")).toEqual(
      metadataBytes,
    );
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

  it("rejects malformed pool metadata before producing a snapshot", () => {
    writePoolMetadata(sourceRoot, []);

    expect(() =>
      createCredentialSnapshot({
        stateRoot: sourceRoot,
        providerId: "openai-codex",
      }),
    ).toThrow(
      expect.objectContaining({
        code: "AUTH_CREDENTIAL_SNAPSHOT_METADATA_INVALID",
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
    requireSnapshotFile(traversal, ACCOUNT_RELATIVE_PATH).relativePath =
      "auth/openai-codex/../escape.json";
    expect(() => validateCredentialSnapshot(traversal)).toThrow(
      expect.objectContaining({
        code: "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
      }),
    );

    const tampered = structuredClone(snapshot);
    const tamperedFile = requireSnapshotFile(tampered, ACCOUNT_RELATIVE_PATH);
    const sameLengthBytes = Buffer.from(tamperedFile.bytesBase64, "base64");
    const firstByte = sameLengthBytes[0];
    if (firstByte === undefined) throw new Error("Encrypted account is empty");
    sameLengthBytes[0] = firstByte ^ 1;
    tamperedFile.bytesBase64 = sameLengthBytes.toString("base64");
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
    requireSnapshotFile(invalid, ACCOUNT_RELATIVE_PATH).sha256 =
      `sha256:${"0".repeat(64)}`;

    expect(() =>
      hydrateCredentialSnapshot({ stateRoot: targetRoot, snapshot: invalid }),
    ).toThrow(
      expect.objectContaining({
        code: "AUTH_CREDENTIAL_SNAPSHOT_FILE_DIGEST_INVALID",
      }),
    );
    expect(fs.readFileSync(sentinel, "utf8")).toBe("target-must-survive");
  });

  it("atomically replaces accounts and metadata while preserving unrelated provider state", () => {
    const sourcePolicy = createIsolatedAccountStoragePolicy(sourceRoot);
    saveAccount(record("alice-primary"), sourcePolicy);
    const metadataBytes = writePoolMetadata(sourceRoot, {
      "openai-codex": {
        "alice-primary": {
          enabled: true,
          health: "ok",
          label: "Primary",
          priority: 0,
        },
      },
    });
    const snapshot = createCredentialSnapshot({
      stateRoot: sourceRoot,
      providerId: "openai-codex",
    });

    const targetAuth = path.join(targetRoot, "auth");
    const targetProvider = path.join(targetAuth, "openai-codex");
    const unrelatedProvider = path.join(targetAuth, "anthropic-subscription");
    fs.mkdirSync(targetProvider, { recursive: true });
    fs.mkdirSync(unrelatedProvider, { recursive: true });
    fs.writeFileSync(path.join(targetProvider, "stale.json"), "stale", {
      mode: 0o600,
    });
    fs.writeFileSync(path.join(unrelatedProvider, "keep.json"), "keep", {
      mode: 0o600,
    });
    writePoolMetadata(targetRoot, { stale: true });

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
    ).toEqual(
      Buffer.from(
        requireSnapshotFile(snapshot, ACCOUNT_RELATIVE_PATH).bytesBase64,
        "base64",
      ),
    );
    expect(fs.readFileSync(path.join(unrelatedProvider, "keep.json"), "utf8")).toBe(
      "keep",
    );
    expect(fs.readFileSync(path.join(targetAuth, "_pool-metadata.json"))).toEqual(
      metadataBytes,
    );
    expect(
      fs.readFileSync(
        path.join(targetAuth, ".credential-storage-generation"),
        "utf8",
      ),
    ).toBe(`${snapshot.storageGeneration}\n`);
  });

  it("removes stale pool metadata when the source snapshot has none", () => {
    const sourcePolicy = createIsolatedAccountStoragePolicy(sourceRoot);
    saveAccount(record("alice-primary"), sourcePolicy);
    const snapshot = createCredentialSnapshot({
      stateRoot: sourceRoot,
      providerId: "openai-codex",
    });
    writePoolMetadata(targetRoot, { stale: true });

    hydrateCredentialSnapshot({ stateRoot: targetRoot, snapshot });

    expect(
      fs.existsSync(path.join(targetRoot, "auth", "_pool-metadata.json")),
    ).toBe(false);
  });
});
