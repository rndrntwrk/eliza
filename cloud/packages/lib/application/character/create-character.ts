import type { Agent } from "@elizaos/core";
import { agentsRepository } from "@/db/repositories/agents/agents";
import type {
  NewUserCharacter,
  UserCharacter,
} from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";
import {
  generateUniqueUsername,
  generateUsernameFromName,
  RESERVED_USERNAMES,
  validateUsername,
} from "@/lib/utils/agent-username";
import { logger } from "@/lib/utils/logger";

export class CreateCharacterUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(data: NewUserCharacter): Promise<UserCharacter> {
    let username = data.username;
    if (!username) {
      const existingUsernames = await this.characters.getAllUsernames();
      for (const reserved of RESERVED_USERNAMES) {
        existingUsernames.add(reserved);
      }
      const baseUsername = generateUsernameFromName(data.name);
      username = generateUniqueUsername(baseUsername, existingUsernames);
      logger.info(
        `[Characters] Generated username: @${username} for "${data.name}"`,
      );
    } else {
      const validation = validateUsername(username);
      if (!validation.valid) {
        throw new Error(`Invalid username: ${validation.error}`);
      }
      username = validation.normalized!;
      const exists = await this.characters.usernameExists(username);
      if (exists) {
        throw new Error("Username is already taken");
      }
    }

    const character = await this.characters.create({ ...data, username });

    const agent: Partial<Agent> = {
      id: character.id as `${string}-${string}-${string}-${string}-${string}`,
      name: character.name,
      username: character.username ?? undefined,
      bio: character.bio as string[] | undefined,
      system: character.system ?? undefined,
      enabled: true,
      settings: character.settings as Record<
        string,
        string | number | boolean | Record<string, string | number | boolean>
      >,
    };
    await agentsRepository.create(agent);

    return character;
  }
}
