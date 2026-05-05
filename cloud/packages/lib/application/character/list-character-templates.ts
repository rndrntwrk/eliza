import type { UserCharacter } from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class ListCharacterTemplatesUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  execute(): Promise<UserCharacter[]> {
    return this.characters.listTemplates();
  }
}
