import type { NewUserCharacter, UserCharacter } from "./character";

export interface CharacterRepository {
  findById(id: string): Promise<UserCharacter | undefined>;
  findByUsername(username: string): Promise<UserCharacter | undefined>;
  usernameExists(username: string): Promise<boolean>;
  getAllUsernames(): Promise<Set<string>>;
  listByUser(
    userId: string,
    source?: "cloud" | "miniapp",
  ): Promise<UserCharacter[]>;
  listByOrganization(
    organizationId: string,
    source?: "cloud" | "miniapp",
  ): Promise<UserCharacter[]>;
  listPublic(options?: {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserCharacter[]>;
  listTemplates(): Promise<UserCharacter[]>;
  create(data: NewUserCharacter): Promise<UserCharacter>;
  update(
    id: string,
    data: Partial<NewUserCharacter>,
  ): Promise<UserCharacter | undefined>;
  delete(id: string): Promise<void>;
  invalidateCache(id: string): Promise<void>;
}
