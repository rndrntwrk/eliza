import type { UserCharacter } from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class GetCharacterByIdUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  execute(id: string): Promise<UserCharacter | undefined> {
    return this.characters.findById(id);
  }
}
