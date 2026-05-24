// Node/runtime barrel for @elizaos/app-core.
// Frontend surfaces live in @elizaos/ui; pure contracts/utilities live in @elizaos/shared.

export * from "./account-pool";
export * from "./api/auth";
export * from "./api/automation-node-contributors";
export * from "./api/compat-route-shared";
export * from "./api/response";
export * from "./api/secrets-inventory-routes";
export * from "./api/secrets-manager-routes";
export * from "./api/server";
export * from "./api/server-security";
export * from "./api/server-wallet-trade";
export * from "./api/training-benchmarks";
export * from "./api/workbench-compat-routes";
export * from "./diagnostics/integration-observability";
export * from "./permissions/types";
// `./platform/empty-node-module` is intentionally NOT re-exported here.
// It exists as a tsconfig-paths target for browser builds — re-exporting it
// would shadow the real api/server, runtime/eliza, etc. exports above with
// noop stubs. Browser bundlers alias it in via the path map; Node imports
// the originals directly through this barrel.
export * from "./registry";
export * from "./runtime/android-avf-microdroid-bridge";
export * from "./runtime/app-route-plugin-registry";
export * from "./runtime/build-character-from-config";
export * from "./runtime/build-variant";
export * from "./runtime/channel-plugin-map";
export * from "./runtime/eliza";
export * from "./runtime/mobile-safe-runtime";
export * from "./security/agent-vault-id";
export * from "./security/hydrate-wallet-keys-from-platform-store";
export * from "./security/platform-secure-store";
export * from "./security/platform-secure-store-node";
export * from "./security/wallet-os-store-actions";
export * from "./services/account-pool";
export * from "./services/auth-store";
export * from "./services/github-credentials";
export * from "./services/plugin-installer";
export * from "./services/steward-credentials";
export * from "./services/steward-sidecar/helpers";
// Explicit .ts extension on steward-sidecar.ts disambiguates from the
// sibling steward-sidecar/ directory: `tsc --rewriteRelativeImportExtensions`
// emits `./services/steward-sidecar.js` in dist, which Node ESM can resolve
// without falling through to the directory and crashing on the missing
// dist/services/steward-sidecar/index.json fallback (the Docker production
// smoke regression observed on PR #7528 / #7530).
export * from "./services/steward-sidecar.ts";
export * from "./services/vault-bootstrap";
export * from "./services/vault-mirror";

// [milaidy:app-core-ui-compat-reexport]
// eliza/packages/app-core/src/ui-compat.ts is a thin compatibility module
// that re-exports UI helpers from @elizaos/ui under the @elizaos/app-core
// surface — useApp, SurfaceCard, SurfaceBadge, GameOperatorShell,
// selectLatestRunForApp, toneForHealthState, etc. plus the matching type
// surface (BabylonChatMessage, AppOperatorSurfaceProps, etc.).
//
// Upstream's app-core/src/index.ts does NOT re-export ui-compat — it only
// exports server-side runtime + api modules. But downstream plugins (like
// eliza/plugins/app-babylon/src/ui/BabylonOperatorSurface.tsx) statically
// import `useApp` and other ui-compat names from "@elizaos/app-core"
// expecting them to be available, and Rollup fails the bind in the SPA build.
//
// Adding the re-export here surfaces every name in ui-compat without
// modifying upstream — ui-compat itself just re-exports from @elizaos/ui
// which is fully browser-safe (it's the UI package).
export * from "./ui-compat";

// [milaidy:app-core-ui-full-reexport]
// Bridge the full @elizaos/ui surface through @elizaos/app-core, mirroring
// upstream-milady's eliza/packages/app-core/src/browser.ts line 1
// (`export * from "@elizaos/ui"`).
//
// Why: alice's main.tsx has 11 import blocks of the form
// `import { ... } from "@elizaos/app-core"` covering ~50 value+type names
// (App, ErrorBoundary, client, AppBootConfig, getBootConfig, dispatchAppEvent,
// AGENT_READY_EVENT, applyForceFreshOnboardingReset, isAppWindowRoute,
// resolveWindowShellRoute, DESKTOP_TRAY_MENU_ITEMS, DesktopTrayRuntime,
// DetachedShellRoot, AppProvider, applyUiTheme, loadUiTheme, AppWindowRenderer,
// BrandingConfig type, etc.). Almost all of these names live in
// `@elizaos/ui`, not `@elizaos/app-core`. Upstream-milady's main.tsx
// works because its package.json exports map `@elizaos/app-core` to
// `browser.ts` for browser builds, which re-exports the whole ui surface.
//
// Alice's pinned eliza (30c595e10ea5) has the older package.json export
// map that resolves `@elizaos/app-core` to `src/index.ts` directly,
// bypassing browser.ts. The result: every one of those 11 import blocks
// fails the Rollup static bind on the SPA build, surfacing one missing
// name per deploy iteration.
//
// Append the same wildcard re-export to alice's pinned app-core/src/index.ts
// to bridge the gap. PR #180's `applyAliceAppCoreUiCompatReexportPatch`
// (`export * from "./ui-compat"`) is a narrow subset of this surface
// (~30 names); this patch is the comprehensive companion. Duplicates with
// ui-compat are harmless at runtime (both routes resolve to the same
// @elizaos/ui source).
//
// Browser safety: `@elizaos/ui` is the UI package — fully browser-safe by
// design. No node:* imports flow into the SPA via this re-export.
export * from "@elizaos/ui";

// Disambiguation: `./registry` and `@elizaos/ui` both export `ConfigField`
// and `getPlugins` with DIFFERENT declarations. `./registry` has the
// Zod-inferred type for plugin config schema fields and a registry loader
// helper; `@elizaos/ui` has a React component and a bridge helper.
// Wildcard `export *` from two sources with the same names → TS2308
// "Module has already exported a member named ..." build error. Mirror the
// disambiguation pattern from upstream-milady's eliza/packages/app-core/
// src/browser.ts line ~51 which pins the registry side explicitly.
export { type ConfigField, getPlugins } from "./registry";

// DesktopOnboardingRuntime is consumed by alice's apps/app/src/main.tsx
// block 8 alongside DESKTOP_TRAY_MENU_ITEMS / DesktopSurfaceNavigationRuntime
// / DesktopTrayRuntime / DetachedShellRoot. The latter four flow through
// the `export * from "@elizaos/ui"` above (they live in
// eliza/packages/ui/src/desktop-runtime/). DesktopOnboardingRuntime does
// NOT exist in @elizaos/ui — upstream's eliza/packages/app-core/src/
// browser.ts line ~62 emits it as a no-op stub. Mirror that here so the
// SPA bind for alice's main.tsx block 8 resolves without throwing.
// Runtime impact: nothing — alice's actual desktop onboarding runtime
// lives in its local packages/app-core/src/shell/DesktopOnboardingRuntime.tsx
// and is referenced through the desktop runtime mount path, not through
// this barrel export. The barrel-bound value is only reached if a SPA
// code path constructs the imported reference directly.
export const DesktopOnboardingRuntime = (): null => null;
