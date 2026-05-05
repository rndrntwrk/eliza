import type { UserCharacter } from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class ListPublicCharactersUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  execute(options?: {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserCharacter[]> {
    return this.characters.listPublic(options);
  }
}
