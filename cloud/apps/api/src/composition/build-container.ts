/**
 * Composition root — wires per-request dependencies.
 *
 * Called once per request from `bootstrap-app.ts` via the composition
 * middleware. The result is stored on Hono context as `c.var.deps` and
 * consumed by route handlers as `c.var.deps.<useCase>.execute(...)`.
 *
 * This is the ONLY place that knows about all three layers (domain
 * interfaces, infrastructure adapters/decorators, application use cases).
 * Routes never instantiate use cases or repositories directly.
 */

import { cache } from "@/lib/cache/client";
import { DeactivateApiKeysByNameUseCase } from "@/lib/application/api-key/deactivate-api-keys-by-name";
import { DeleteApiKeyUseCase } from "@/lib/application/api-key/delete-api-key";
import { GetApiKeyByIdUseCase } from "@/lib/application/api-key/get-api-key-by-id";
import { IncrementApiKeyUsageUseCase } from "@/lib/application/api-key/increment-api-key-usage";
import { IssueApiKeyUseCase } from "@/lib/application/api-key/issue-api-key";
import { ListApiKeysByOrganizationUseCase } from "@/lib/application/api-key/list-api-keys-by-organization";
import { UpdateApiKeyUseCase } from "@/lib/application/api-key/update-api-key";
import { ValidateApiKeyUseCase } from "@/lib/application/api-key/validate-api-key";
import { ClaimAffiliateCharacterUseCase } from "@/lib/application/character/claim-affiliate-character";
import { CreateCharacterUseCase } from "@/lib/application/character/create-character";
import { DeleteCharacterUseCase } from "@/lib/application/character/delete-character";
import { GetCharacterByIdUseCase } from "@/lib/application/character/get-character-by-id";
import { GetCharacterByIdForUserUseCase } from "@/lib/application/character/get-character-by-id-for-user";
import { GetCharacterByUsernameUseCase } from "@/lib/application/character/get-character-by-username";
import { GetSavedAgentDetailsUseCase } from "@/lib/application/character/get-saved-agent-details";
import { GetSavedAgentsForUserUseCase } from "@/lib/application/character/get-saved-agents-for-user";
import { InvalidateCharacterCacheUseCase } from "@/lib/application/character/invalidate-character-cache";
import { IsClaimableAffiliateCharacterUseCase } from "@/lib/application/character/is-claimable-affiliate-character";
import { ListCharacterTemplatesUseCase } from "@/lib/application/character/list-character-templates";
import { ListCharactersByOrganizationUseCase } from "@/lib/application/character/list-characters-by-organization";
import { ListCharactersByUserUseCase } from "@/lib/application/character/list-characters-by-user";
import { ListPublicCharactersUseCase } from "@/lib/application/character/list-public-characters";
import { RemoveSavedAgentUseCase } from "@/lib/application/character/remove-saved-agent";
import { UpdateCharacterUseCase } from "@/lib/application/character/update-character";
import { UpdateCharacterForUserUseCase } from "@/lib/application/character/update-character-for-user";
import { CreateOrganizationUseCase } from "@/lib/application/organization/create-organization";
import { DeleteOrganizationUseCase } from "@/lib/application/organization/delete-organization";
import { GetOrganizationByIdUseCase } from "@/lib/application/organization/get-organization-by-id";
import { GetOrganizationBySlugUseCase } from "@/lib/application/organization/get-organization-by-slug";
import { GetOrganizationByStripeCustomerIdUseCase } from "@/lib/application/organization/get-organization-by-stripe-customer-id";
import { GetOrganizationWithUsersUseCase } from "@/lib/application/organization/get-organization-with-users";
import { UpdateOrganizationUseCase } from "@/lib/application/organization/update-organization";
import { UpdateOrganizationCreditBalanceUseCase } from "@/lib/application/organization/update-organization-credit-balance";
import { CheckAppNameAvailabilityUseCase } from "@/lib/application/app/check-app-name-availability";
import { GetAppAnalyticsUseCase } from "@/lib/application/app/get-app-analytics";
import { GetAppByApiKeyIdUseCase } from "@/lib/application/app/get-app-by-api-key-id";
import { GetAppByIdUseCase } from "@/lib/application/app/get-app-by-id";
import { GetAppRecentRequestsUseCase } from "@/lib/application/app/get-app-recent-requests";
import { GetAppRequestsOverTimeUseCase } from "@/lib/application/app/get-app-requests-over-time";
import { GetAppRequestStatsUseCase } from "@/lib/application/app/get-app-request-stats";
import { GetAppTopVisitorsUseCase } from "@/lib/application/app/get-app-top-visitors";
import { GetAppTotalStatsUseCase } from "@/lib/application/app/get-app-total-stats";
import { GetAppUsersUseCase } from "@/lib/application/app/get-app-users";
import { ListAppsByOrganizationUseCase } from "@/lib/application/app/list-apps-by-organization";
import { TrackAppPageViewUseCase } from "@/lib/application/app/track-app-page-view";
import { UpdateAppUseCase } from "@/lib/application/app/update-app";
import { CreateUserUseCase } from "@/lib/application/user/create-user";
import { DeleteUserUseCase } from "@/lib/application/user/delete-user";
import { GetUserByEmailUseCase } from "@/lib/application/user/get-user-by-email";
import { GetUserByIdUseCase } from "@/lib/application/user/get-user-by-id";
import { GetUserByStewardIdUseCase } from "@/lib/application/user/get-user-by-steward-id";
import { GetUserWithOrganizationUseCase } from "@/lib/application/user/get-user-with-organization";
import { ListUsersByOrganizationUseCase } from "@/lib/application/user/list-users-by-organization";
import { UpdateUserUseCase } from "@/lib/application/user/update-user";
import type { ApiKeyRepository } from "@/lib/domain/api-key/api-key-repository";
import type { AppRepository } from "@/lib/domain/app/app-repository";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";
import type { OrganizationRepository } from "@/lib/domain/organization/organization-repository";
import type { UserRepository } from "@/lib/domain/user/user-repository";
import { CachedApiKeyRepository } from "@/lib/infrastructure/cache/api-key/cached-api-key-repository";
import { CachedAppRepository } from "@/lib/infrastructure/cache/app/cached-app-repository";
import { CachedCharacterRepository } from "@/lib/infrastructure/cache/character/cached-character-repository";
import { CachedOrganizationRepository } from "@/lib/infrastructure/cache/organization/cached-organization-repository";
import { CachedUserRepository } from "@/lib/infrastructure/cache/user/cached-user-repository";
import { PostgresApiKeyRepository } from "@/lib/infrastructure/db/api-key/postgres-api-key-repository";
import { PostgresAppRepository } from "@/lib/infrastructure/db/app/postgres-app-repository";
import { PostgresCharacterRepository } from "@/lib/infrastructure/db/character/postgres-character-repository";
import { PostgresOrganizationRepository } from "@/lib/infrastructure/db/organization/postgres-organization-repository";
import { PostgresUserRepository } from "@/lib/infrastructure/db/user/postgres-user-repository";
import type { Bindings, CompositionContext } from "@/types/cloud-worker-env";

export function buildContainer(_env: Bindings): CompositionContext {
  const apiKeyRepo: ApiKeyRepository = new CachedApiKeyRepository(
    new PostgresApiKeyRepository(),
    cache,
  );
  const organizationRepo: OrganizationRepository =
    new CachedOrganizationRepository(
      new PostgresOrganizationRepository(),
      cache,
    );
  const userRepo: UserRepository = new CachedUserRepository(
    new PostgresUserRepository(),
    cache,
  );
  const appRepo: AppRepository = new CachedAppRepository(
    new PostgresAppRepository(),
    cache,
  );
  const characterRepo: CharacterRepository = new CachedCharacterRepository(
    new PostgresCharacterRepository(),
    cache,
  );

  return {
    issueApiKey: new IssueApiKeyUseCase(apiKeyRepo),
    validateApiKey: new ValidateApiKeyUseCase(apiKeyRepo),
    incrementApiKeyUsage: new IncrementApiKeyUsageUseCase(apiKeyRepo),
    getApiKeyById: new GetApiKeyByIdUseCase(apiKeyRepo),
    listApiKeysByOrganization: new ListApiKeysByOrganizationUseCase(apiKeyRepo),
    updateApiKey: new UpdateApiKeyUseCase(apiKeyRepo),
    deleteApiKey: new DeleteApiKeyUseCase(apiKeyRepo),
    deactivateApiKeysByName: new DeactivateApiKeysByNameUseCase(apiKeyRepo),

    getOrganizationById: new GetOrganizationByIdUseCase(organizationRepo),
    getOrganizationBySlug: new GetOrganizationBySlugUseCase(organizationRepo),
    getOrganizationByStripeCustomerId:
      new GetOrganizationByStripeCustomerIdUseCase(organizationRepo),
    getOrganizationWithUsers: new GetOrganizationWithUsersUseCase(
      organizationRepo,
    ),
    createOrganization: new CreateOrganizationUseCase(organizationRepo),
    updateOrganization: new UpdateOrganizationUseCase(organizationRepo),
    updateOrganizationCreditBalance: new UpdateOrganizationCreditBalanceUseCase(
      organizationRepo,
    ),
    deleteOrganization: new DeleteOrganizationUseCase(organizationRepo),

    getUserById: new GetUserByIdUseCase(userRepo),
    getUserByEmail: new GetUserByEmailUseCase(userRepo),
    getUserByStewardId: new GetUserByStewardIdUseCase(userRepo),
    getUserWithOrganization: new GetUserWithOrganizationUseCase(userRepo),
    listUsersByOrganization: new ListUsersByOrganizationUseCase(userRepo),
    createUser: new CreateUserUseCase(userRepo),
    updateUser: new UpdateUserUseCase(userRepo),
    deleteUser: new DeleteUserUseCase(userRepo),

    getAppById: new GetAppByIdUseCase(appRepo),
    getAppByApiKeyId: new GetAppByApiKeyIdUseCase(appRepo),
    listAppsByOrganization: new ListAppsByOrganizationUseCase(appRepo),
    checkAppNameAvailability: new CheckAppNameAvailabilityUseCase(appRepo),
    updateApp: new UpdateAppUseCase(appRepo),
    trackAppPageView: new TrackAppPageViewUseCase(appRepo),
    getAppRequestStats: new GetAppRequestStatsUseCase(appRepo),
    getAppRecentRequests: new GetAppRecentRequestsUseCase(appRepo),
    getAppTopVisitors: new GetAppTopVisitorsUseCase(appRepo),
    getAppRequestsOverTime: new GetAppRequestsOverTimeUseCase(appRepo),
    getAppUsers: new GetAppUsersUseCase(appRepo),
    getAppAnalytics: new GetAppAnalyticsUseCase(appRepo),
    getAppTotalStats: new GetAppTotalStatsUseCase(appRepo),

    getCharacterById: new GetCharacterByIdUseCase(characterRepo),
    getCharacterByIdForUser: new GetCharacterByIdForUserUseCase(characterRepo),
    getCharacterByUsername: new GetCharacterByUsernameUseCase(characterRepo),
    listCharactersByUser: new ListCharactersByUserUseCase(characterRepo),
    listCharactersByOrganization: new ListCharactersByOrganizationUseCase(
      characterRepo,
    ),
    listPublicCharacters: new ListPublicCharactersUseCase(characterRepo),
    listCharacterTemplates: new ListCharacterTemplatesUseCase(characterRepo),
    createCharacter: new CreateCharacterUseCase(characterRepo),
    updateCharacter: new UpdateCharacterUseCase(characterRepo),
    updateCharacterForUser: new UpdateCharacterForUserUseCase(characterRepo),
    deleteCharacter: new DeleteCharacterUseCase(characterRepo),
    invalidateCharacterCache: new InvalidateCharacterCacheUseCase(
      characterRepo,
    ),
    isClaimableAffiliateCharacter: new IsClaimableAffiliateCharacterUseCase(
      characterRepo,
      userRepo,
    ),
    claimAffiliateCharacter: new ClaimAffiliateCharacterUseCase(
      characterRepo,
      userRepo,
    ),
    getSavedAgentsForUser: new GetSavedAgentsForUserUseCase(),
    getSavedAgentDetails: new GetSavedAgentDetailsUseCase(),
    removeSavedAgent: new RemoveSavedAgentUseCase(),
  };
}
