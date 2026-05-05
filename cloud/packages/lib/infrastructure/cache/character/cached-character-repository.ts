import type { Cache } from "@/lib/domain/cache/cache";
import type {
  NewUserCharacter,
  UserCharacter,
} from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";
import { InMemoryLRUCache } from "@/lib/cache/in-memory-lru-cache";
import { CacheKeys, CacheTTL } from "@/lib/cache/keys";
import { logger } from "@/lib/utils/logger";

const characterCacheKey = (id: string) => `character:data:${id}`;
const CHARACTER_CACHE_TTL = CacheTTL.agent.characterData;

const inMemoryCharCache = new InMemoryLRUCache<UserCharacter>(100, 60_000);

export class CachedCharacterRepository implements CharacterRepository {
  constructor(
    private readonly inner: CharacterRepository,
    private readonly cache: Cache,
  ) {}

  async findById(id: string): Promise<UserCharacter | undefined> {
    const inMemoryHit = inMemoryCharCache.get(id);
    if (inMemoryHit) {
      return structuredClone(inMemoryHit);
    }

    const cacheKey = characterCacheKey(id);
    const cached = await this.cache.get<UserCharacter>(cacheKey);
    if (cached) {
      inMemoryCharCache.set(id, cached);
      return structuredClone(cached);
    }

    const character = await this.inner.findById(id);
    if (character) {
      await this.cache.set(cacheKey, character, CHARACTER_CACHE_TTL);
      inMemoryCharCache.set(id, character);
      return structuredClone(character);
    }
    return character;
  }

  findByUsername(username: string): Promise<UserCharacter | undefined> {
    return this.inner.findByUsername(username);
  }

  usernameExists(username: string): Promise<boolean> {
    return this.inner.usernameExists(username);
  }

  getAllUsernames(): Promise<Set<string>> {
    return this.inner.getAllUsernames();
  }

  listByUser(
    userId: string,
    source: "cloud" | "miniapp" = "cloud",
  ): Promise<UserCharacter[]> {
    return this.inner.listByUser(userId, source);
  }

  listByOrganization(
    organizationId: string,
    source: "cloud" | "miniapp" = "cloud",
  ): Promise<UserCharacter[]> {
    return this.inner.listByOrganization(organizationId, source);
  }

  listPublic(options?: {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserCharacter[]> {
    return this.inner.listPublic(options);
  }

  listTemplates(): Promise<UserCharacter[]> {
    return this.inner.listTemplates();
  }

  async create(data: NewUserCharacter): Promise<UserCharacter> {
    const character = await this.inner.create(data);
    await this.cache.del(CacheKeys.org.dashboard(data.organization_id));
    return character;
  }

  async update(
    id: string,
    data: Partial<NewUserCharacter>,
  ): Promise<UserCharacter | undefined> {
    const updated = await this.inner.update(id, data);
    if (updated) {
      await this.invalidateCache(id);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const character = await this.findById(id);
    await this.inner.delete(id);
    if (character) {
      await Promise.all([
        this.cache.del(
          CacheKeys.org.dashboard(character.organization_id),
        ),
        this.invalidateCache(id),
      ]);
    }
  }

  async invalidateCache(id: string): Promise<void> {
    inMemoryCharCache.delete(id);
    const { invalidateCharacterCache } =
      await import("@/lib/cache/character-cache");
    await Promise.all([
      this.cache.del(characterCacheKey(id)),
      invalidateCharacterCache(id),
    ]);
    logger.info(`[Characters] Cache invalidated for character: ${id}`);
  }
}
