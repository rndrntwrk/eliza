import { afterEach, describe, expect, it, vi } from "vitest";
import {
  commitDurableCredentials,
  hydrateDurableCredentials,
  installCredentialDurabilityBridge,
  type CredentialDurabilityBridge,
} from "./credential-durability.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function bridge(
  overrides: Partial<CredentialDurabilityBridge> = {},
): CredentialDurabilityBridge {
  return {
    hydrate: vi.fn(async () => null),
    commit: vi.fn(async () => null),
    ...overrides,
  };
}

afterEach(() => {
  installCredentialDurabilityBridge(null);
  vi.restoreAllMocks();
});

describe("credential durability bridge", () => {
  it("is an explicit no-op when no cloud durability bridge is installed", async () => {
    await expect(
      hydrateDurableCredentials({ stateRoot: "/tmp/no-bridge" }),
    ).resolves.toBeNull();
    await expect(
      commitDurableCredentials({
        stateRoot: "/tmp/no-bridge",
        reason: "oauth-link",
      }),
    ).resolves.toBeNull();
  });

  it("does not resolve a commit until the installed bridge resolves", async () => {
    const pending = deferred<{
      generation: number;
      snapshotSha256: `sha256:${string}`;
    }>();
    const installed = bridge({
      commit: vi.fn(() => pending.promise),
    });
    installCredentialDurabilityBridge(installed);

    let settled = false;
    const resultPromise = commitDurableCredentials({
      stateRoot: "/tmp/alice",
      reason: "codex-rotation",
    }).finally(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(installed.commit).toHaveBeenCalledWith({
      stateRoot: "/tmp/alice",
      reason: "codex-rotation",
    });

    pending.resolve({
      generation: 7,
      snapshotSha256: `sha256:${"a".repeat(64)}`,
    });

    await expect(resultPromise).resolves.toEqual({
      generation: 7,
      snapshotSha256: `sha256:${"a".repeat(64)}`,
    });
  });

  it("propagates bridge rejection instead of degrading durability to telemetry", async () => {
    const error = new Error("durable state unavailable");
    installCredentialDurabilityBridge(
      bridge({
        commit: vi.fn(async () => {
          throw error;
        }),
      }),
    );

    await expect(
      commitDurableCredentials({
        stateRoot: "/tmp/alice",
        reason: "token-refresh",
      }),
    ).rejects.toBe(error);
  });

  it("prevents an old disposer from clearing a newer bridge", async () => {
    const first = bridge();
    const second = bridge();
    const disposeFirst = installCredentialDurabilityBridge(first);
    installCredentialDurabilityBridge(second);

    disposeFirst();
    await commitDurableCredentials({
      stateRoot: "/tmp/alice",
      reason: "account-update",
    });

    expect(first.commit).not.toHaveBeenCalled();
    expect(second.commit).toHaveBeenCalledTimes(1);
  });
});
