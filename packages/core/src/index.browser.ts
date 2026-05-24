/**
 * Browser-specific entry point for @elizaos/core
 *
 * This file exports only browser-compatible modules and provides
 * stubs or alternatives for Node.js-specific functionality.
 * Streaming context manager is auto-detected at runtime.
 */

export * from "./actions";
export * from "./api/http-helpers";
export * from "./api/route-helpers";
export * from "./app-registry";
// Export core modules (all browser-compatible after refactoring)
export * from "./app-route-plugin-registry";
export * from "./build-variant";
export * from "./character";
// cloud-routing has zero Node deps (pure type narrowing + string building),
// so the browser entry can re-export it. Several renderer-visible app-core
// modules (e.g. services/sensitive-requests/public-link-adapter) depend on
// `toRuntimeSettings` and the route helpers.
export * from "./cloud-routing";
export * from "./connectors";
export * from "./connectors/account-manager";
export * from "./connectors/connector-config";
export * from "./connectors/privacy";
export * from "./database";
export * from "./database/inMemoryAdapter";
export * from "./entities";
export * from "./features/advanced-memory";
export { AutonomyService } from "./features/autonomy/index";
export {
	__setDocumentUrlFetchImplForTests,
	type FetchDocumentFromUrlOptions,
	type FetchedDocumentUrl,
	type FetchedDocumentUrlKind,
	fetchDocumentFromUrl,
	isYouTubeUrl,
} from "./features/documents/index";
export { paymentsPlugin } from "./features/payments/index";
export * from "./lifeops-passive-connectors";
export * from "./logger";
export * from "./memory";
export * from "./prompts";
export * from "./roles";
export * from "./runtime";
export * from "./runtime/context-gates";
export * from "./runtime/context-registry";
export * from "./runtime/execute-planned-tool-call";
export * from "./runtime/schema-compat";
export * from "./runtime/sub-planner";
export * from "./runtime/system-prompt";
export * from "./runtime-route-context";
export * from "./sandbox-policy";
// Export schemas (including buildBaseTables for plugin-sql browser/PGLite builds)
export * from "./schemas/character";
export { type BaseTables, buildBaseTables } from "./schemas/index";
export * from "./search";
export * from "./sensitive-request-policy";
export * from "./sensitive-requests";
export * from "./services";
export * from "./services/agentEvent";
// Server/runtime entry points also register these; the browser bundle must
// expose the same symbols so Vite/esbuild can statically resolve plugins that
// list them in `services` (see @elizaos/agent runtime).
export { AgentEventService } from "./services/agentEvent";
export * from "./services/message";
export * from "./services/trajectories";
export * from "./settings";
export * from "./streaming-context";
export * from "./trajectory-context";
export * from "./trajectory-utils";
export type { ConnectorAccountCapability, ConnectorAccountRef } from "./types";
// Export everything from types (type-only, safe for browser)
export * from "./types";
export {
	ConnectorAccountHealth,
	ConnectorAccountPurpose,
	ConnectorAccountRole,
	ConnectorAuthMethod,
} from "./types";
export * from "./types/message-service";
export type { JsonObject, JsonValue } from "./types/primitives";
// Export utils first to avoid circular dependency issues
export * from "./utils";
export { Semaphore } from "./utils/batch-queue/semaphore.js";
export * from "./utils/buffer";
export * from "./utils/description-compressed-lint";
// Export browser-compatible utilities
export * from "./utils/environment";
export { formatError } from "./utils/format-error";

export function resolveStateDir(): string {
	return "/.eliza";
}

export async function runPluginMigrations(): Promise<void> {}

// Browser-specific exports or stubs for Node-only features
export const isBrowser = true;
export const isNode = false;

/**
 * Browser stub for server health checks
 * In browser environment, this is a no-op
 */
export const serverHealth = {
	check: async () => ({ status: "not-applicable", environment: "browser" }),
	isHealthy: () => true,
};

// [milaidy:core-browser-runtime-env-reexport]
// eliza/packages/core/src/runtime-env.ts exports ~30 pure-JS helpers
// (resolveApiSecurityConfig, resolveAllowedOrigins, resolveApiBindHost,
// DEFAULT_DESKTOP_API_PORT, etc.) used by plugins that bundle into the SPA
// (notably plugin-elizacloud/src/services/cloud-auth.ts which statically
// imports resolveApiSecurityConfig). Upstream's index.node.ts re-exports
// runtime-env wholesale (line ~203: `export * from "./runtime-env"`),
// but index.browser.ts does not — even though runtime-env.ts has zero
// node-specific imports (only "./env-utils.js" sibling + pure regex/string).
// Rollup fails the static bind in the SPA build when the missing names are
// referenced. Re-exporting runtime-env from the browser entry resolves the
// entire family of names in one shot, mirroring upstream's node-entry
// surface for these browser-safe utilities.
export * from "./runtime-env";

// [milaidy:core-browser-state-dir-stubs]
// eliza/packages/core/src/utils/state-dir.ts exports resolveStateDir,
// resolveUserPath, getElizaNamespace, resolveOAuthDir, migrateStateDir.
// The module itself imports node:fs/promises, node:os, node:path so it
// CANNOT be re-exported wholesale into the browser entry (would pull
// node built-ins into the SPA bundle). index.browser.ts already provides
// an inline stub for resolveStateDir (returns "/.eliza"). The remaining
// four names are imported by plugin-elizacloud SPA-bundled files —
// notably plugin-elizacloud/src/lib/state-paths.ts statically imports
// resolveUserPath and getElizaNamespace from @elizaos/core — and Rollup
// fails the bind without them. Provide signature-compatible no-op
// stubs that return safe defaults. None of these are reached at runtime
// in the browser (plugin-elizacloud's state-paths is gated behind
// isNode() at call sites).
export function resolveUserPath(input: string): string {
	return typeof input === "string" ? input.trim() : "";
}
export function getElizaNamespace(): string {
	return "eliza";
}
export function resolveOAuthDir(): string {
	return "/.eliza/credentials";
}
export async function migrateStateDir(): Promise<{ migrated: boolean }> {
	return { migrated: false };
}

// [milaidy:core-browser-onboarding-reexport]
// eliza/packages/core/src/contracts/onboarding.ts defines ~50 names —
// migrateLegacyRuntimeConfig, isCloudInferenceSelectedInConfig,
// isSubscriptionProviderSelectionId, normalizeOnboardingProviderId,
// the full ONBOARDING_PROVIDER_CATALOG and SUBSCRIPTION_PROVIDER_SELECTIONS
// constants, ProviderOption / CloudProviderOption / ModelOption / etc.
// types. Upstream's index.node.ts re-exports them via "./contracts/onboarding".
// index.browser.ts omits it even though onboarding.ts is fully browser-safe
// (imports only "../env-utils.js" + sibling "./service-routing.js" types/
// normalizers, all pure JS — no node:* / fs / path / os / process anywhere).
// plugin-elizacloud/src/routes/cloud-routes-autonomous.ts statically imports
// migrateLegacyRuntimeConfig from @elizaos/core, and Rollup fails the bind.
// Re-exporting wholesale surfaces the entire onboarding contract family
// (the canonical implementations — also lets the existing missingExports
// vite-stub for OnboardingStateMachine / isOnboardingComplete fall through
// to the real implementations if onboarding.ts exports them).
export * from "./contracts/onboarding";

// [milaidy:core-browser-settings-debug-reexport]
// eliza/packages/core/src/settings-debug.ts exports isElizaSettingsDebugEnabled,
// sanitizeForSettingsDebug, and settingsDebugCloudSummary. Upstream's
// index.node.ts re-exports the first two via a named-export block (line ~248).
// index.browser.ts omits the module entirely — even though settings-debug.ts
// is fully browser-safe: imports only "./env-utils.js" (pure), uses
// typeof process !== "undefined" defensively, and reads import.meta.env for
// Vite/browser environments. plugin-elizacloud/src/lib/cloud-connection.ts
// statically imports isElizaSettingsDebugEnabled AND settingsDebugCloudSummary
// from @elizaos/core, and Rollup fails the bind. Wholesale re-export surfaces
// both names plus sanitizeForSettingsDebug (which the node entry oddly omits).
export * from "./settings-debug";

// [milaidy:core-browser-cloud-topology-reexport]
// eliza/packages/core/src/contracts/cloud-topology.ts exports the
// ElizaCloud config-introspection helpers used by plugin-elizacloud:
//   isElizaCloudLinkedInConfig, resolveElizaCloudTopology,
//   isElizaCloudServiceSelectedInConfig, shouldLoadElizaCloudPluginInConfig.
// Upstream's index.node.ts has `export { isElizaCloudServiceSelectedInConfig
// } from "./contracts/cloud-topology"` (line ~45) and the file itself is
// fully browser-safe: imports only "./onboarding.js" (sibling, now
// browser-safe via PR #173) and pure type/function definitions. No
// node:* / fs / path / os / crypto imports anywhere. Plugin-elizacloud's
// cloud-status-routes.ts statically imports
// isElizaCloudServiceSelectedInConfig and Rollup fails the bind.
export * from "./contracts/cloud-topology";

// [milaidy:core-browser-spoken-text-reexport]
// eliza/packages/core/src/spoken-text.ts exports sanitizeSpeechText
// (and ~3 sibling helpers — collapseWhitespace, stripUrls, etc., though
// only sanitizeSpeechText is exported by name from index.node.ts).
// The file is 65 lines, has ZERO imports (pure regex/string functions),
// and is trivially browser-safe. plugin-elizacloud/src/lib/server-cloud-tts.ts
// statically imports sanitizeSpeechText from @elizaos/core and Rollup
// fails the bind. index.node.ts re-exports it via a named-export block
// (line ~252: `export { sanitizeSpeechText } from "./spoken-text"`).
// Wholesale wildcard re-export pulls in any additional public helpers
// if they get added upstream.
export * from "./spoken-text";

// [milaidy:core-browser-validation-reexport]
// eliza/packages/core/src/validation exports validateActionKeywords,
// validateActionRegex, and pure secret-format validators. index.node.ts and
// index.edge.ts re-export this module, but index.browser.ts omits it. Browser
// Vite builds can still statically bind plugins through @elizaos/core, and
// plugin-shell/plugin-social-alpha/plugin-mysticism import these helpers.
// The validation module has no node:* imports, so mirroring the edge/node
// surface is browser-safe and fixes Rollup missing-export failures.
export * from "./validation";

// [milaidy:core-browser-milady-runtime-bindings]
// Parent Milady's browser build statically scans some server/runtime modules
// during dev. The browser entry must expose the same public names those modules
// import from the node entry, without pulling node-only runtime capability
// graphs into the SPA.
export {
	resolveSecretKeyAlias,
	SECRET_KEY_ALIASES,
} from "./constants/secrets";
export {
	DEFAULT_ELIZA_CLOUD_FREE_TEXT_MODEL,
	DEFAULT_ELIZA_CLOUD_TEXT_MODEL,
} from "./contracts/service-routing";
export function createBasicCapabilitiesPlugin() {
	return { name: "stub" };
}

// [milaidy:core-browser-onboarding-types-disambiguate]
// Pin MessageExample to types/agent to resolve TS2308 ambiguity.
//
// Two different MessageExample interfaces exist in @elizaos/core and
// both reach this barrel:
//   types/agent           { name: string;  content: Content }
//   contracts/onboarding  { user: string;  content: MessageExampleContent }
// Different field names, different content type. types/agent is the
// canonical agent surface consumed by the Character + Agent types and
// by downstream eliza-cli / app-core / runtime-boot. The onboarding
// MessageExample is a narrower shape used only inside the onboarding
// flow definitions.
//
// Explicit named export wins over wildcard re-exports for TS resolution,
// so this pin selects the agent-canonical interface regardless of
// wildcard ordering.
export type { MessageExample } from "./types/agent";
