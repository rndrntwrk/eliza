import { userCharactersRepository } from "@/db/repositories";
import type {
  NewUserCharacter,
  UserCharacter,
} from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class PostgresCharacterRepository implements CharacterRepository {
  findById(id: string): Promise<UserCharacter | undefined> {
    return userCharactersRepository.findById(id);
  }

  findByUsername(username: string): Promise<UserCharacter | undefined> {
    return userCharactersRepository.findByUsername(username);
  }

  usernameExists(username: string): Promise<boolean> {
    return userCharactersRepository.usernameExists(username);
  }

  getAllUsernames(): Promise<Set<string>> {
    return userCharactersRepository.getAllUsernames();
  }

  listByUser(
    userId: string,
    source: "cloud" | "miniapp" = "cloud",
  ): Promise<UserCharacter[]> {
    return userCharactersRepository.listByUser(userId, source);
  }

  listByOrganization(
    organizationId: string,
    source: "cloud" | "miniapp" = "cloud",
  ): Promise<UserCharacter[]> {
    return userCharactersRepository.listByOrganization(organizationId, source);
  }

  listPublic(options?: {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserCharacter[]> {
    return userCharactersRepository.listPublic(options);
  }

  listTemplates(): Promise<UserCharacter[]> {
    return userCharactersRepository.listTemplates();
  }

  create(data: NewUserCharacter): Promise<UserCharacter> {
    return userCharactersRepository.create(data);
  }

  update(
    id: string,
    data: Partial<NewUserCharacter>,
  ): Promise<UserCharacter | undefined> {
    return userCharactersRepository.update(id, data);
  }

  delete(id: string): Promise<void> {
    return userCharactersRepository.delete(id);
  }

  async invalidateCache(_id: string): Promise<void> {
    // No-op at the DB layer; cache invalidation is owned by the cache decorator.
  }
}
