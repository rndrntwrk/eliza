/**
 * Optional process-local bridge from Eliza's encrypted credential store to a
 * host-owned durable persistence boundary.
 *
 * Desktop and ordinary local runtimes do not install a bridge, so the helpers
 * are explicit no-ops there. Cloud runtimes install one before Eliza starts and
 * await these helpers at credential mutation boundaries. A bridge rejection is
 * deliberately propagated: durable credential persistence is load-bearing once
 * a host installs the bridge and must never degrade to best-effort telemetry.
 */

export type CredentialDurabilityReason =
  | "oauth-link"
  | "token-refresh"
  | "account-update"
  | "account-delete"
  | "account-reset"
  | "codex-rotation";

export interface CredentialDurabilityReceipt {
  /** Host-owned compare-and-swap revision, independent of Eliza's reset fence. */
  durabilityGeneration: number;
  snapshotSha256: `sha256:${string}`;
}

export interface CredentialDurabilityHydrateInput {
  stateRoot: string;
}

export interface CredentialDurabilityCommitInput {
  stateRoot: string;
  reason: CredentialDurabilityReason;
}

export interface CredentialDurabilityBridge {
  hydrate(
    input: CredentialDurabilityHydrateInput,
  ): Promise<CredentialDurabilityReceipt | null>;
  commit(
    input: CredentialDurabilityCommitInput,
  ): Promise<CredentialDurabilityReceipt | null>;
}

const CREDENTIAL_DURABILITY_BRIDGE = Symbol.for(
  "@elizaos/auth/credential-durability-bridge/v1",
);

type GlobalDurabilitySlot = Record<symbol, unknown>;

function durabilitySlot(): GlobalDurabilitySlot | null {
  return typeof globalThis === "undefined"
    ? null
    : (globalThis as GlobalDurabilitySlot);
}

export function getCredentialDurabilityBridge(): CredentialDurabilityBridge | null {
  const slot = durabilitySlot();
  if (!slot) return null;
  return (
    (slot[CREDENTIAL_DURABILITY_BRIDGE] as
      | CredentialDurabilityBridge
      | undefined) ?? null
  );
}

/**
 * Install or clear the host durability bridge.
 *
 * The returned disposer clears only the exact bridge installed by this call,
 * so teardown from an older host/test cannot remove a newer replacement.
 */
export function installCredentialDurabilityBridge(
  bridge: CredentialDurabilityBridge | null,
): () => void {
  const slot = durabilitySlot();
  if (!slot) return () => undefined;

  if (bridge) {
    slot[CREDENTIAL_DURABILITY_BRIDGE] = bridge;
  } else {
    delete slot[CREDENTIAL_DURABILITY_BRIDGE];
  }

  return () => {
    const currentSlot = durabilitySlot();
    if (!currentSlot || !bridge) return;
    if (currentSlot[CREDENTIAL_DURABILITY_BRIDGE] === bridge) {
      delete currentSlot[CREDENTIAL_DURABILITY_BRIDGE];
    }
  };
}

export async function hydrateDurableCredentials(
  input: CredentialDurabilityHydrateInput,
): Promise<CredentialDurabilityReceipt | null> {
  const bridge = getCredentialDurabilityBridge();
  return bridge ? bridge.hydrate(input) : null;
}

export async function commitDurableCredentials(
  input: CredentialDurabilityCommitInput,
): Promise<CredentialDurabilityReceipt | null> {
  const bridge = getCredentialDurabilityBridge();
  return bridge ? bridge.commit(input) : null;
}
