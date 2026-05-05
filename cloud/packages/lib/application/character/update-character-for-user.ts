import type {
  NewUserCharacter,
  UserCharacter,
} from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";
import { validateUsername } from "@/lib/utils/agent-username";
import { logger } from "@/lib/utils/logger";

export class UpdateCharacterForUserUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(
    characterId: string,
    userId: string,
    updates: Partial<NewUserCharacter>,
  ): Promise<UserCharacter | undefined> {
    const character = await this.characters.findById(characterId);
    if (!character || character.user_id !== userId) {
      return undefined;
    }

    if (updates.username !== undefined) {
      if (updates.username === null) {
        logger.info(
          `[Characters] Username cleared: @${character.username} → null`,
        );
      } else {
        const normalizedUsername = updates.username.toLowerCase();
        if (normalizedUsername !== character.username) {
          const validation = validateUsername(normalizedUsername);
          if (!validation.valid) {
            throw new Error(`Invalid username: ${validation.error}`);
          }
          const existing =
            await this.characters.findByUsername(normalizedUsername);
          if (existing && existing.id !== characterId) {
            throw new Error("Invalid username: This username is already taken");
          }
          updates.username = normalizedUsername;
          logger.info(
            `[Characters] Username updated: @${character.username} → @${updates.username}`,
          );
        } else {
          updates.username = normalizedUsername;
        }
      }
    }

    return this.characters.update(characterId, updates);
  }
}
