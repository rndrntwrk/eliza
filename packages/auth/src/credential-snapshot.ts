/**
 * Deterministic, encrypted-only snapshots of canonical subscription credentials.
 *
 * A snapshot contains only the encrypted account envelopes already produced by
 * account-storage plus its reset-generation fence. Disposable CLI homes are
 * never included. The host persistence layer owns its own durability revision;
 * `storageGeneration` here is only Eliza's local reset fence.
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ElizaError } from "@elizaos/core";
import { assertCanonicalAccountId } from "./account-storage.ts";

export const CREDENTIAL_SNAPSHOT_SCHEMA =
  "eliza.credential-snapshot.v1" as const;
export const CREDENTIAL_SNAPSHOT_PROVIDER = "openai-codex" as const;

const GENERATION_RELATIVE_PATH = "auth/.credential-storage-generation";
const PROVIDER_RELATIVE_ROOT = `auth/${CREDENTIAL_SNAPSHOT_PROVIDER}`;
const STORAGE_LOCK_DIRECTORY = ".credential-storage.lock";
const MAX_ACCOUNT_FILES = 32;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SNAPSHOT_TOP_LEVEL_KEYS = [
  "files",
  "providerId",
  "schemaVersion",
  "snapshotSha256",
  "storageGeneration",
] as const;
const SNAPSHOT_FILE_KEYS = [
  "bytesBase64",
  "mode",
  "relativePath",
  "sha256",
  "size",
] as const;

export interface CredentialSnapshotFileV1 {
  relativePath: string;
  mode: 0o600;
  size: number;
  sha256: `sha256:${string}`;
  bytesBase64: string;
}

export interface CredentialSnapshotV1 {
  schemaVersion: typeof CREDENTIAL_SNAPSHOT_SCHEMA;
  providerId: typeof CREDENTIAL_SNAPSHOT_PROVIDER;
  /** Local reset fence. This is not the host durability CAS revision. */
  storageGeneration: number;
  files: CredentialSnapshotFileV1[];
  snapshotSha256: `sha256:${string}`;
}

export interface CredentialSnapshotReceipt {
  storageGeneration: number;
  snapshotSha256: `sha256:${string}`;
}

interface DecodedSnapshot {
  snapshot: CredentialSnapshotV1;
  files: Map<string, Buffer>;
}

function snapshotError(
  code: string,
  message: string,
  context: Record<string, unknown> = {},
  cause?: unknown,
): ElizaError {
  return new ElizaError(message, {
    code,
    context,
    severity: "fatal",
    ...(cause !== undefined ? { cause } : {}),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index])
  );
}

function sha256(bytes: Buffer | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fsyncDirectory(directory: string): void {
  if (process.platform === "win32") return;
  const descriptor = fs.openSync(
    directory,
    fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY ?? 0),
  );
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function canonicalStateRoot(stateRoot: string): string {
  if (typeof stateRoot !== "string" || !path.isAbsolute(stateRoot)) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_STATE_ROOT_INVALID",
      "Credential snapshot state root must be an absolute path",
      { stateRoot: String(stateRoot).slice(0, 256) },
    );
  }
  const resolved = path.resolve(stateRoot);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(resolved);
  } catch (cause) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_STATE_ROOT_INVALID",
      "Credential snapshot state root is unavailable",
      { stateRoot: resolved },
      cause,
    );
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_STATE_ROOT_INVALID",
      "Credential snapshot state root must be a real directory",
      { stateRoot: resolved },
    );
  }
  const physical = fs.realpathSync.native(resolved);
  if (physical !== resolved) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_STATE_ROOT_INVALID",
      "Credential snapshot state root cannot traverse symbolic links",
      { physical, stateRoot: resolved },
    );
  }
  return resolved;
}

function assertRealDirectory(directory: string, operation: string): void {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
      `Credential snapshot ${operation} directory must be real`,
      { directory, operation },
    );
  }
  if (fs.realpathSync.native(directory) !== path.resolve(directory)) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
      `Credential snapshot ${operation} directory cannot traverse symbolic links`,
      { directory, operation },
    );
  }
}

function readRegularFileNoFollow(
  file: string,
  operation: string,
): { bytes: Buffer; mode: number } {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(
      file,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
    );
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile()) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
        "Credential snapshot source must be a regular file",
        { file, operation },
      );
    }
    if (opened.size > MAX_FILE_BYTES) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_FILE_TOO_LARGE",
        "Credential snapshot source exceeds the per-file limit",
        { file, operation, size: opened.size },
      );
    }
    const pathStat = fs.lstatSync(file);
    if (
      pathStat.isSymbolicLink() ||
      pathStat.dev !== opened.dev ||
      pathStat.ino !== opened.ino
    ) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
        "Credential snapshot source changed while open",
        { file, operation },
      );
    }
    return {
      bytes: fs.readFileSync(descriptor),
      mode: opened.mode & 0o777,
    };
  } catch (cause) {
    if (cause instanceof ElizaError) throw cause;
    if ((cause as NodeJS.ErrnoException).code === "ELOOP") {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
        "Credential snapshot source cannot be a symbolic link",
        { file, operation },
        cause,
      );
    }
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_READ_FAILED",
      "Credential snapshot source could not be read safely",
      { file, operation },
      cause,
    );
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function assertMode0600(mode: number, relativePath: string): void {
  if (mode !== 0o600) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_MODE_INVALID",
      "Credential snapshot files must use mode 0600",
      { mode, relativePath },
    );
  }
}

function assertEncryptedAccountEnvelope(
  bytes: Buffer,
  relativePath: string,
): void {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (cause) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_UNENCRYPTED_ACCOUNT",
      "Credential snapshot account file is not an encrypted envelope",
      { relativePath },
      cause,
    );
  }
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["ciphertext", "schemaVersion"]) ||
    value.schemaVersion !== 2 ||
    typeof value.ciphertext !== "string" ||
    value.ciphertext.length === 0
  ) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_UNENCRYPTED_ACCOUNT",
      "Credential snapshot account file is not an encrypted envelope",
      { relativePath },
    );
  }
}

function assertCanonicalAccountRelativePath(relativePath: string): string {
  if (
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath.includes("\0")
  ) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
      "Credential snapshot contains a non-canonical relative path",
      { relativePath },
    );
  }
  const prefix = `${PROVIDER_RELATIVE_ROOT}/`;
  if (!relativePath.startsWith(prefix) || !relativePath.endsWith(".json")) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
      "Credential snapshot path is outside the managed provider",
      { relativePath },
    );
  }
  const accountId = relativePath.slice(prefix.length, -".json".length);
  if (!accountId || accountId.includes("/")) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
      "Credential snapshot account path must be a direct provider child",
      { relativePath },
    );
  }
  try {
    assertCanonicalAccountId(accountId);
  } catch (cause) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
      "Credential snapshot account id is not canonical",
      { relativePath },
      cause,
    );
  }
  return accountId;
}

function makeFile(
  relativePath: string,
  bytes: Buffer,
  mode: number,
): CredentialSnapshotFileV1 {
  assertMode0600(mode, relativePath);
  if (bytes.length > MAX_FILE_BYTES) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_FILE_TOO_LARGE",
      "Credential snapshot file exceeds the per-file limit",
      { relativePath, size: bytes.length },
    );
  }
  return {
    relativePath,
    mode: 0o600,
    size: bytes.length,
    sha256: sha256(bytes),
    bytesBase64: bytes.toString("base64"),
  };
}

function canonicalSnapshotPayload(
  snapshot: Omit<CredentialSnapshotV1, "snapshotSha256">,
): string {
  return JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    providerId: snapshot.providerId,
    storageGeneration: snapshot.storageGeneration,
    files: snapshot.files.map((file) => ({
      relativePath: file.relativePath,
      mode: file.mode,
      size: file.size,
      sha256: file.sha256,
      bytesBase64: file.bytesBase64,
    })),
  });
}

function readStorageGeneration(authRoot: string): {
  generation: number;
  bytes: Buffer;
} {
  const file = path.join(authRoot, ".credential-storage-generation");
  if (!fs.existsSync(file)) {
    return { generation: 0, bytes: Buffer.from("0\n", "utf8") };
  }
  const read = readRegularFileNoFollow(file, "read-generation");
  assertMode0600(read.mode, GENERATION_RELATIVE_PATH);
  const text = read.bytes.toString("utf8");
  if (!/^(0|[1-9]\d*)\n$/.test(text)) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_GENERATION_INVALID",
      "Credential storage generation is not canonical",
      { relativePath: GENERATION_RELATIVE_PATH },
    );
  }
  const generation = Number(text.slice(0, -1));
  if (!Number.isSafeInteger(generation) || generation < 0) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_GENERATION_INVALID",
      "Credential storage generation is outside the supported range",
      { relativePath: GENERATION_RELATIVE_PATH },
    );
  }
  return { generation, bytes: read.bytes };
}

export function createCredentialSnapshot(input: {
  stateRoot: string;
  providerId: typeof CREDENTIAL_SNAPSHOT_PROVIDER;
}): CredentialSnapshotV1 {
  if (input.providerId !== CREDENTIAL_SNAPSHOT_PROVIDER) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_PROVIDER_INVALID",
      "Credential snapshot provider is not supported",
      { providerId: String(input.providerId) },
    );
  }
  const stateRoot = canonicalStateRoot(input.stateRoot);
  const authRoot = path.join(stateRoot, "auth");
  if (fs.existsSync(authRoot)) {
    assertRealDirectory(authRoot, "auth-root");
    if (fs.existsSync(path.join(authRoot, STORAGE_LOCK_DIRECTORY))) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_STORAGE_BUSY",
        "Credential snapshot cannot run while the storage lock is present",
        {},
      );
    }
  }

  const generation = fs.existsSync(authRoot)
    ? readStorageGeneration(authRoot)
    : { generation: 0, bytes: Buffer.from("0\n", "utf8") };
  const files: CredentialSnapshotFileV1[] = [
    makeFile(GENERATION_RELATIVE_PATH, generation.bytes, 0o600),
  ];
  const providerRoot = path.join(authRoot, CREDENTIAL_SNAPSHOT_PROVIDER);
  if (fs.existsSync(providerRoot)) {
    assertRealDirectory(providerRoot, "provider-root");
    for (const entry of fs
      .readdirSync(providerRoot, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.name.endsWith(".json")) continue;
      if (entry.name.endsWith(".tmp.json") || entry.name.endsWith(".json.tmp")) {
        continue;
      }
      if (!entry.isFile() && !entry.isSymbolicLink()) {
        throw snapshotError(
          "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
          "Credential snapshot account entry must be a regular file",
          { entry: entry.name },
        );
      }
      const relativePath = `${PROVIDER_RELATIVE_ROOT}/${entry.name}`;
      assertCanonicalAccountRelativePath(relativePath);
      const read = readRegularFileNoFollow(
        path.join(providerRoot, entry.name),
        "read-account",
      );
      assertMode0600(read.mode, relativePath);
      assertEncryptedAccountEnvelope(read.bytes, relativePath);
      files.push(makeFile(relativePath, read.bytes, read.mode));
    }
  }
  if (files.length - 1 > MAX_ACCOUNT_FILES) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_FILE_COUNT_INVALID",
      "Credential snapshot contains too many account files",
      { accountFileCount: files.length - 1, maximum: MAX_ACCOUNT_FILES },
    );
  }
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_TOO_LARGE",
      "Credential snapshot exceeds the total byte limit",
      { maximum: MAX_TOTAL_BYTES, totalBytes },
    );
  }

  const payload: Omit<CredentialSnapshotV1, "snapshotSha256"> = {
    schemaVersion: CREDENTIAL_SNAPSHOT_SCHEMA,
    providerId: CREDENTIAL_SNAPSHOT_PROVIDER,
    storageGeneration: generation.generation,
    files,
  };
  return {
    ...payload,
    snapshotSha256: sha256(canonicalSnapshotPayload(payload)),
  };
}

function decodeCanonicalBase64(
  value: unknown,
  relativePath: string,
): Buffer {
  if (
    typeof value !== "string" ||
    value.length > Math.ceil((MAX_FILE_BYTES * 4) / 3) + 4
  ) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_BASE64_INVALID",
      "Credential snapshot file bytes are not bounded canonical base64",
      { relativePath },
    );
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_BASE64_INVALID",
      "Credential snapshot file bytes are not canonical base64",
      { relativePath },
    );
  }
  return bytes;
}

function validateAndDecodeCredentialSnapshot(snapshot: unknown): DecodedSnapshot {
  if (!isRecord(snapshot) || !hasExactKeys(snapshot, SNAPSHOT_TOP_LEVEL_KEYS)) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_SCHEMA_INVALID",
      "Credential snapshot has an invalid top-level shape",
    );
  }
  if (snapshot.schemaVersion !== CREDENTIAL_SNAPSHOT_SCHEMA) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_SCHEMA_INVALID",
      "Credential snapshot schema version is unsupported",
      { schemaVersion: String(snapshot.schemaVersion) },
    );
  }
  if (snapshot.providerId !== CREDENTIAL_SNAPSHOT_PROVIDER) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_PROVIDER_INVALID",
      "Credential snapshot provider is not supported",
      { providerId: String(snapshot.providerId) },
    );
  }
  if (
    !Number.isSafeInteger(snapshot.storageGeneration) ||
    (snapshot.storageGeneration as number) < 0
  ) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_GENERATION_INVALID",
      "Credential snapshot storage generation is invalid",
      { storageGeneration: snapshot.storageGeneration },
    );
  }
  if (
    !Array.isArray(snapshot.files) ||
    snapshot.files.length < 1 ||
    snapshot.files.length > MAX_ACCOUNT_FILES + 1
  ) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_FILE_COUNT_INVALID",
      "Credential snapshot file count is outside the supported range",
      { fileCount: Array.isArray(snapshot.files) ? snapshot.files.length : null },
    );
  }

  const normalizedFiles: CredentialSnapshotFileV1[] = [];
  const decoded = new Map<string, Buffer>();
  let totalBytes = 0;
  let previousPath = "";
  let generationFound = false;

  for (const candidate of snapshot.files) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, SNAPSHOT_FILE_KEYS)) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_SCHEMA_INVALID",
        "Credential snapshot file entry has an invalid shape",
      );
    }
    if (typeof candidate.relativePath !== "string") {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
        "Credential snapshot file path must be a string",
      );
    }
    const relativePath = candidate.relativePath;
    if (relativePath <= previousPath) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
        "Credential snapshot file paths must be unique and sorted",
        { relativePath },
      );
    }
    previousPath = relativePath;

    if (relativePath === GENERATION_RELATIVE_PATH) {
      if (generationFound) {
        throw snapshotError(
          "AUTH_CREDENTIAL_SNAPSHOT_PATH_INVALID",
          "Credential snapshot contains duplicate generation files",
        );
      }
      generationFound = true;
    } else {
      assertCanonicalAccountRelativePath(relativePath);
    }

    if (candidate.mode !== 0o600) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_MODE_INVALID",
        "Credential snapshot files must use mode 0600",
        { mode: candidate.mode, relativePath },
      );
    }
    if (
      !Number.isSafeInteger(candidate.size) ||
      (candidate.size as number) < 0 ||
      (candidate.size as number) > MAX_FILE_BYTES
    ) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_FILE_TOO_LARGE",
        "Credential snapshot file size is invalid",
        { relativePath, size: candidate.size },
      );
    }
    const bytes = decodeCanonicalBase64(candidate.bytesBase64, relativePath);
    if (bytes.length !== candidate.size) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_FILE_SIZE_INVALID",
        "Credential snapshot file size does not match its bytes",
        { actual: bytes.length, expected: candidate.size, relativePath },
      );
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_TOO_LARGE",
        "Credential snapshot exceeds the total byte limit",
        { maximum: MAX_TOTAL_BYTES, totalBytes },
      );
    }
    if (
      typeof candidate.sha256 !== "string" ||
      !SHA256_PATTERN.test(candidate.sha256) ||
      sha256(bytes) !== candidate.sha256
    ) {
      throw snapshotError(
        "AUTH_CREDENTIAL_SNAPSHOT_FILE_DIGEST_INVALID",
        "Credential snapshot file digest does not match its bytes",
        { relativePath },
      );
    }

    if (relativePath === GENERATION_RELATIVE_PATH) {
      const expectedGeneration = `${snapshot.storageGeneration}\n`;
      if (bytes.toString("utf8") !== expectedGeneration) {
        throw snapshotError(
          "AUTH_CREDENTIAL_SNAPSHOT_GENERATION_INVALID",
          "Credential snapshot generation file does not match storageGeneration",
          { relativePath },
        );
      }
    } else {
      assertEncryptedAccountEnvelope(bytes, relativePath);
    }

    const normalized: CredentialSnapshotFileV1 = {
      relativePath,
      mode: 0o600,
      size: candidate.size as number,
      sha256: candidate.sha256 as `sha256:${string}`,
      bytesBase64: candidate.bytesBase64 as string,
    };
    normalizedFiles.push(normalized);
    decoded.set(relativePath, bytes);
  }

  if (!generationFound) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_GENERATION_INVALID",
      "Credential snapshot is missing its storage generation file",
    );
  }
  if (
    typeof snapshot.snapshotSha256 !== "string" ||
    !SHA256_PATTERN.test(snapshot.snapshotSha256)
  ) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_DIGEST_INVALID",
      "Credential snapshot digest has an invalid shape",
    );
  }

  const normalizedWithoutDigest: Omit<CredentialSnapshotV1, "snapshotSha256"> = {
    schemaVersion: CREDENTIAL_SNAPSHOT_SCHEMA,
    providerId: CREDENTIAL_SNAPSHOT_PROVIDER,
    storageGeneration: snapshot.storageGeneration as number,
    files: normalizedFiles,
  };
  const expectedDigest = sha256(
    canonicalSnapshotPayload(normalizedWithoutDigest),
  );
  if (snapshot.snapshotSha256 !== expectedDigest) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_DIGEST_INVALID",
      "Credential snapshot digest does not match its canonical payload",
    );
  }

  return {
    snapshot: {
      ...normalizedWithoutDigest,
      snapshotSha256: expectedDigest,
    },
    files: decoded,
  };
}

export function validateCredentialSnapshot(
  snapshot: unknown,
): CredentialSnapshotV1 {
  return validateAndDecodeCredentialSnapshot(snapshot).snapshot;
}

function writeExclusiveFile(file: string, bytes: Buffer): void {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(
      file,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_NOFOLLOW,
      0o600,
    );
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

export function hydrateCredentialSnapshot(input: {
  stateRoot: string;
  snapshot: unknown;
}): CredentialSnapshotReceipt {
  // Validate the complete untrusted snapshot before touching the target root.
  const validated = validateAndDecodeCredentialSnapshot(input.snapshot);
  const stateRoot = canonicalStateRoot(input.stateRoot);
  const authRoot = path.join(stateRoot, "auth");
  if (fs.existsSync(authRoot)) {
    assertRealDirectory(authRoot, "hydrate-auth-root");
  } else {
    fs.mkdirSync(authRoot, { mode: 0o700 });
    fsyncDirectory(stateRoot);
  }
  if (fs.existsSync(path.join(authRoot, STORAGE_LOCK_DIRECTORY))) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_STORAGE_BUSY",
      "Credential snapshot cannot hydrate while the storage lock is present",
    );
  }

  const transactionId = `${process.pid}.${randomUUID()}`;
  const stageRoot = path.join(authRoot, `.credential-snapshot-stage.${transactionId}`);
  const stageProvider = path.join(stageRoot, CREDENTIAL_SNAPSHOT_PROVIDER);
  const stageGeneration = path.join(
    stageRoot,
    ".credential-storage-generation",
  );
  const targetProvider = path.join(authRoot, CREDENTIAL_SNAPSHOT_PROVIDER);
  const targetGeneration = path.join(
    authRoot,
    ".credential-storage-generation",
  );
  const backupProvider = path.join(
    authRoot,
    `.credential-snapshot-backup-provider.${transactionId}`,
  );
  const backupGeneration = path.join(
    authRoot,
    `.credential-snapshot-backup-generation.${transactionId}`,
  );

  let providerBackedUp = false;
  let providerInstalled = false;
  let generationBackedUp = false;
  let generationInstalled = false;

  try {
    fs.mkdirSync(stageRoot, { mode: 0o700 });
    fs.mkdirSync(stageProvider, { mode: 0o700 });
    for (const [relativePath, bytes] of validated.files) {
      if (relativePath === GENERATION_RELATIVE_PATH) {
        writeExclusiveFile(stageGeneration, bytes);
        continue;
      }
      const accountId = assertCanonicalAccountRelativePath(relativePath);
      writeExclusiveFile(path.join(stageProvider, `${accountId}.json`), bytes);
    }
    fsyncDirectory(stageProvider);
    fsyncDirectory(stageRoot);

    if (fs.existsSync(targetProvider)) {
      assertRealDirectory(targetProvider, "hydrate-target-provider");
      fs.renameSync(targetProvider, backupProvider);
      providerBackedUp = true;
    }
    fs.renameSync(stageProvider, targetProvider);
    providerInstalled = true;

    if (fs.existsSync(targetGeneration)) {
      const generation = readRegularFileNoFollow(
        targetGeneration,
        "hydrate-target-generation",
      );
      assertMode0600(generation.mode, GENERATION_RELATIVE_PATH);
      fs.renameSync(targetGeneration, backupGeneration);
      generationBackedUp = true;
    }
    fs.renameSync(stageGeneration, targetGeneration);
    generationInstalled = true;
    fsyncDirectory(authRoot);
  } catch (cause) {
    const rollbackFailures: string[] = [];
    try {
      if (generationInstalled && fs.existsSync(targetGeneration)) {
        fs.rmSync(targetGeneration, { force: false });
      }
      if (generationBackedUp && fs.existsSync(backupGeneration)) {
        fs.renameSync(backupGeneration, targetGeneration);
      }
    } catch (rollbackCause) {
      rollbackFailures.push(`generation: ${String(rollbackCause)}`);
    }
    try {
      if (providerInstalled && fs.existsSync(targetProvider)) {
        fs.rmSync(targetProvider, { recursive: true, force: false });
      }
      if (providerBackedUp && fs.existsSync(backupProvider)) {
        fs.renameSync(backupProvider, targetProvider);
      }
    } catch (rollbackCause) {
      rollbackFailures.push(`provider: ${String(rollbackCause)}`);
    }
    try {
      fsyncDirectory(authRoot);
    } catch (rollbackCause) {
      rollbackFailures.push(`fsync: ${String(rollbackCause)}`);
    }
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_HYDRATE_FAILED",
      "Credential snapshot hydration failed and was rolled back",
      { rollbackFailures },
      cause,
    );
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }

  try {
    if (providerBackedUp) {
      fs.rmSync(backupProvider, { recursive: true, force: false });
    }
    if (generationBackedUp) {
      fs.rmSync(backupGeneration, { force: false });
    }
    fsyncDirectory(authRoot);
  } catch (cause) {
    throw snapshotError(
      "AUTH_CREDENTIAL_SNAPSHOT_CLEANUP_FAILED",
      "Credential snapshot hydrated but its encrypted backup cleanup failed",
      {},
      cause,
    );
  }

  return {
    storageGeneration: validated.snapshot.storageGeneration,
    snapshotSha256: validated.snapshot.snapshotSha256,
  };
}
