/**
 * Hono + Cloudflare Workers context types for the Cloud API.
 *
 * Bindings: env vars and platform resources injected by Workers.
 * Variables: per-request values populated by middleware (e.g. resolved user).
 */

import type { Context } from "hono";
import type { RuntimeR2Bucket } from "../lib/storage/r2-runtime-binding";

export interface Bindings {
  // ---- Database (Neon Postgres in cloud, PGlite locally) ----
  DATABASE_URL: string;
  DATABASE_URL_UNPOOLED?: string;

  // ---- Cloudflare R2 ----
  /** Object storage for voice samples, avatars, and other binary blobs. */
  BLOB: RuntimeR2Bucket;

  // ---- Cloudflare Registrar/DNS ----
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  ELIZA_CF_REGISTRAR_DEV_STUB?: string;

  // ---- ElevenLabs ----
  ELEVENLABS_API_KEY?: string;

  // ---- AI providers ----
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI_GATEWAY_API_KEY?: string;
  AIGATEWAY_API_KEY?: string;
  AI_GATEWAY_BASE_URL?: string;
  VERCEL_OIDC_TOKEN?: string;
  /**
   * Public hostname that serves the BLOB R2 bucket. Used to construct sample
   * URLs returned to clients. Defaults to "blob.elizacloud.ai" if unset.
   */
  R2_PUBLIC_HOST?: string;
  SQL_HEAVY_PAYLOAD_STORAGE?: string;
  SQL_HEAVY_PAYLOAD_MIN_BYTES?: string;
  SQL_HEAVY_PAYLOAD_INLINE_PREVIEW_BYTES?: string;
  LLM_TRAJECTORY_STORAGE?: string;

  // ---- Steward (auth provider) ----
  STEWARD_API_URL?: string;
  /** Server-side base URL mirror for SSR fetches that don't go through the SDK. */
  NEXT_PUBLIC_STEWARD_API_URL?: string;
  /** HS256 secret for verifying Steward session JWTs (jose). Either name works. */
  STEWARD_SESSION_SECRET?: string;
  STEWARD_JWT_SECRET?: string;
  /** Steward vault encryption master password. Required for wallet/key operations. */
  STEWARD_MASTER_PASSWORD?: string;
  /** Tenant scoping. */
  STEWARD_TENANT_ID?: string;
  NEXT_PUBLIC_STEWARD_TENANT_ID?: string;
  STEWARD_DEFAULT_TENANT_ID?: string;
  STEWARD_DEFAULT_TENANT_KEY?: string;
  /** Server-only platform / tenant API keys. */
  STEWARD_PLATFORM_KEYS?: string;
  STEWARD_TENANT_API_KEY?: string;
  RPC_URL?: string;
  CHAIN_ID?: string;

  // ---- Redis (Upstash REST in cloud, Wadis embedded locally) ----
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;

  // ---- Stripe ----
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_CURRENCY?: string;

  // ---- Crypto payments ----
  OXAPAY_WEBHOOK_IPS?: string;
  OXAPAY_MERCHANT_API_KEY?: string;

  // ---- Cron auth ----
  CRON_SECRET?: string;

  // ---- App config ----
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_API_URL?: string;
  ELIZA_APP_WEBHOOK_GATEWAY_URL?: string;
  WEBHOOK_GATEWAY_URL?: string;
  GATEWAY_WEBHOOK_URL?: string;
  ELIZA_APP_WEBHOOK_PROJECT?: string;
  ELIZA_APP_DISCORD_WEBHOOK_HANDLER_URL?: string;
  DISCORD_WEBHOOK_HANDLER_URL?: string;
  CONTAINER_CONTROL_PLANE_URL?: string;
  HETZNER_CONTAINER_CONTROL_PLANE_URL?: string;
  CONTAINER_CONTROL_PLANE_TOKEN?: string;
  VERTEX_TUNING_CONTROL_PLANE_URL?: string;
  VERTEX_TUNING_HANDLER_URL?: string;
  VERTEX_TUNING_CONTROL_PLANE_TOKEN?: string;
  N8N_BRIDGE_CONTROL_PLANE_URL?: string;
  N8N_BRIDGE_URL?: string;
  N8N_BRIDGE_CONTROL_PLANE_TOKEN?: string;
  NODE_ENV?: string;

  // ---- Feature flags ----
  REDIS_RATE_LIMITING?: string;
  CACHE_ENABLED?: string;
  RATE_LIMIT_DISABLED?: string;
  RATE_LIMIT_MULTIPLIER?: string;
  PLAYWRIGHT_TEST_AUTH?: string;
  PLAYWRIGHT_TEST_AUTH_SECRET?: string;
  TWILIO_SMS_COST_PER_SEGMENT_USD?: string;

  // Allow overflow — handlers can read any env var via c.env.
  [key: string]: unknown;
}

/**
 * Currently-resolved user. Kept loose because the shared
 * `UserWithOrganization` type pulls in DB types we don't want to depend on
 * from every auth shim. Use `requireUser(c)` to get a typed result.
 */
export interface AuthedUser {
  id: string;
  email?: string | null;
  organization_id?: string | null;
  organization?: { id: string; name?: string; is_active?: boolean } | null;
  is_active?: boolean;
  role?: string;
  steward_id?: string | null;
  wallet_address?: string | null;
  is_anonymous?: boolean;
}

/**
 * Per-request dependency container — populated by the composition middleware
 * in `apps/api/src/composition/build-container.ts`, consumed by routes as
 * `c.var.deps.<useCase>.execute(...)`.
 *
 * Defined here (rather than in build-container.ts) so packages/lib/* sees
 * the full shape during standalone typecheck.
 */
import type { DeactivateApiKeysByNameUseCase } from "@/lib/application/api-key/deactivate-api-keys-by-name";
import type { DeleteApiKeyUseCase } from "@/lib/application/api-key/delete-api-key";
import type { GetApiKeyByIdUseCase } from "@/lib/application/api-key/get-api-key-by-id";
import type { IncrementApiKeyUsageUseCase } from "@/lib/application/api-key/increment-api-key-usage";
import type { IssueApiKeyUseCase } from "@/lib/application/api-key/issue-api-key";
import type { ListApiKeysByOrganizationUseCase } from "@/lib/application/api-key/list-api-keys-by-organization";
import type { UpdateApiKeyUseCase } from "@/lib/application/api-key/update-api-key";
import type { ValidateApiKeyUseCase } from "@/lib/application/api-key/validate-api-key";
import type { CheckAppNameAvailabilityUseCase } from "@/lib/application/app/check-app-name-availability";
import type { GetAppAnalyticsUseCase } from "@/lib/application/app/get-app-analytics";
import type { GetAppByApiKeyIdUseCase } from "@/lib/application/app/get-app-by-api-key-id";
import type { GetAppByIdUseCase } from "@/lib/application/app/get-app-by-id";
import type { GetAppRecentRequestsUseCase } from "@/lib/application/app/get-app-recent-requests";
import type { GetAppRequestsOverTimeUseCase } from "@/lib/application/app/get-app-requests-over-time";
import type { GetAppRequestStatsUseCase } from "@/lib/application/app/get-app-request-stats";
import type { GetAppTopVisitorsUseCase } from "@/lib/application/app/get-app-top-visitors";
import type { GetAppTotalStatsUseCase } from "@/lib/application/app/get-app-total-stats";
import type { GetAppUsersUseCase } from "@/lib/application/app/get-app-users";
import type { ListAppsByOrganizationUseCase } from "@/lib/application/app/list-apps-by-organization";
import type { TrackAppPageViewUseCase } from "@/lib/application/app/track-app-page-view";
import type { UpdateAppUseCase } from "@/lib/application/app/update-app";
import type { CreateOrganizationUseCase } from "@/lib/application/organization/create-organization";
import type { DeleteOrganizationUseCase } from "@/lib/application/organization/delete-organization";
import type { GetOrganizationByIdUseCase } from "@/lib/application/organization/get-organization-by-id";
import type { GetOrganizationBySlugUseCase } from "@/lib/application/organization/get-organization-by-slug";
import type { GetOrganizationByStripeCustomerIdUseCase } from "@/lib/application/organization/get-organization-by-stripe-customer-id";
import type { GetOrganizationWithUsersUseCase } from "@/lib/application/organization/get-organization-with-users";
import type { UpdateOrganizationUseCase } from "@/lib/application/organization/update-organization";
import type { UpdateOrganizationCreditBalanceUseCase } from "@/lib/application/organization/update-organization-credit-balance";
import type { ClaimAffiliateCharacterUseCase } from "@/lib/application/character/claim-affiliate-character";
import type { CreateCharacterUseCase } from "@/lib/application/character/create-character";
import type { DeleteCharacterUseCase } from "@/lib/application/character/delete-character";
import type { GetCharacterByIdUseCase } from "@/lib/application/character/get-character-by-id";
import type { GetCharacterByIdForUserUseCase } from "@/lib/application/character/get-character-by-id-for-user";
import type { GetCharacterByUsernameUseCase } from "@/lib/application/character/get-character-by-username";
import type { GetSavedAgentDetailsUseCase } from "@/lib/application/character/get-saved-agent-details";
import type { GetSavedAgentsForUserUseCase } from "@/lib/application/character/get-saved-agents-for-user";
import type { InvalidateCharacterCacheUseCase } from "@/lib/application/character/invalidate-character-cache";
import type { IsClaimableAffiliateCharacterUseCase } from "@/lib/application/character/is-claimable-affiliate-character";
import type { ListCharacterTemplatesUseCase } from "@/lib/application/character/list-character-templates";
import type { ListCharactersByOrganizationUseCase } from "@/lib/application/character/list-characters-by-organization";
import type { ListCharactersByUserUseCase } from "@/lib/application/character/list-characters-by-user";
import type { ListPublicCharactersUseCase } from "@/lib/application/character/list-public-characters";
import type { RemoveSavedAgentUseCase } from "@/lib/application/character/remove-saved-agent";
import type { UpdateCharacterUseCase } from "@/lib/application/character/update-character";
import type { UpdateCharacterForUserUseCase } from "@/lib/application/character/update-character-for-user";
import type { CreateUserUseCase } from "@/lib/application/user/create-user";
import type { DeleteUserUseCase } from "@/lib/application/user/delete-user";
import type { GetUserByEmailUseCase } from "@/lib/application/user/get-user-by-email";
import type { GetUserByIdUseCase } from "@/lib/application/user/get-user-by-id";
import type { GetUserByStewardIdUseCase } from "@/lib/application/user/get-user-by-steward-id";
import type { GetUserWithOrganizationUseCase } from "@/lib/application/user/get-user-with-organization";
import type { ListUsersByOrganizationUseCase } from "@/lib/application/user/list-users-by-organization";
import type { UpdateUserUseCase } from "@/lib/application/user/update-user";

export interface CompositionContext {
  // ── ApiKey aggregate ──────────────────────────────────────────────────
  issueApiKey: IssueApiKeyUseCase;
  validateApiKey: ValidateApiKeyUseCase;
  incrementApiKeyUsage: IncrementApiKeyUsageUseCase;
  getApiKeyById: GetApiKeyByIdUseCase;
  listApiKeysByOrganization: ListApiKeysByOrganizationUseCase;
  updateApiKey: UpdateApiKeyUseCase;
  deleteApiKey: DeleteApiKeyUseCase;
  deactivateApiKeysByName: DeactivateApiKeysByNameUseCase;

  // ── Organization aggregate ────────────────────────────────────────────
  getOrganizationById: GetOrganizationByIdUseCase;
  getOrganizationBySlug: GetOrganizationBySlugUseCase;
  getOrganizationByStripeCustomerId: GetOrganizationByStripeCustomerIdUseCase;
  getOrganizationWithUsers: GetOrganizationWithUsersUseCase;
  createOrganization: CreateOrganizationUseCase;
  updateOrganization: UpdateOrganizationUseCase;
  updateOrganizationCreditBalance: UpdateOrganizationCreditBalanceUseCase;
  deleteOrganization: DeleteOrganizationUseCase;

  // ── User aggregate ────────────────────────────────────────────────────
  getUserById: GetUserByIdUseCase;
  getUserByEmail: GetUserByEmailUseCase;
  getUserByStewardId: GetUserByStewardIdUseCase;
  getUserWithOrganization: GetUserWithOrganizationUseCase;
  listUsersByOrganization: ListUsersByOrganizationUseCase;
  createUser: CreateUserUseCase;
  updateUser: UpdateUserUseCase;
  deleteUser: DeleteUserUseCase;

  // ── App aggregate ─────────────────────────────────────────────────────
  getAppById: GetAppByIdUseCase;
  getAppByApiKeyId: GetAppByApiKeyIdUseCase;
  listAppsByOrganization: ListAppsByOrganizationUseCase;
  checkAppNameAvailability: CheckAppNameAvailabilityUseCase;
  updateApp: UpdateAppUseCase;
  trackAppPageView: TrackAppPageViewUseCase;
  getAppRequestStats: GetAppRequestStatsUseCase;
  getAppRecentRequests: GetAppRecentRequestsUseCase;
  getAppTopVisitors: GetAppTopVisitorsUseCase;
  getAppRequestsOverTime: GetAppRequestsOverTimeUseCase;
  getAppUsers: GetAppUsersUseCase;
  getAppAnalytics: GetAppAnalyticsUseCase;
  getAppTotalStats: GetAppTotalStatsUseCase;

  // ── Character aggregate ───────────────────────────────────────────────
  getCharacterById: GetCharacterByIdUseCase;
  getCharacterByIdForUser: GetCharacterByIdForUserUseCase;
  getCharacterByUsername: GetCharacterByUsernameUseCase;
  listCharactersByUser: ListCharactersByUserUseCase;
  listCharactersByOrganization: ListCharactersByOrganizationUseCase;
  listPublicCharacters: ListPublicCharactersUseCase;
  listCharacterTemplates: ListCharacterTemplatesUseCase;
  createCharacter: CreateCharacterUseCase;
  updateCharacter: UpdateCharacterUseCase;
  updateCharacterForUser: UpdateCharacterForUserUseCase;
  deleteCharacter: DeleteCharacterUseCase;
  invalidateCharacterCache: InvalidateCharacterCacheUseCase;
  isClaimableAffiliateCharacter: IsClaimableAffiliateCharacterUseCase;
  claimAffiliateCharacter: ClaimAffiliateCharacterUseCase;
  getSavedAgentsForUser: GetSavedAgentsForUserUseCase;
  getSavedAgentDetails: GetSavedAgentDetailsUseCase;
  removeSavedAgent: RemoveSavedAgentUseCase;
}

export interface Variables {
  user: AuthedUser | null | undefined;
  authMethod?: "session" | "api_key" | "wallet_signature" | "anonymous";
  requestId: string;
  /**
   * Per-request use-case container. Always set by the composition middleware
   * mounted in `apps/api/src/bootstrap-app.ts`. Empty until Phase B; after
   * that, contains use cases per migrated aggregate.
   */
  deps: CompositionContext;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

export type AppContext = Context<AppEnv>;
