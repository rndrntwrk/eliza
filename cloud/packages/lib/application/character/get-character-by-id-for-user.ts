import type { UserCharacter } from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class GetCharacterByIdForUserUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(
    characterId: string,
    userId: string,
  ): Promise<UserCharacter | undefined> {
    const character = await this.characters.findById(characterId);
    if (!character || character.user_id !== userId) {
      return undefined;
    }
    return character;
  }
}
