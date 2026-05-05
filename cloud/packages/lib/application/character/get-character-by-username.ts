import type { UserCharacter } from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class GetCharacterByUsernameUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  execute(username: string): Promise<UserCharacter | undefined> {
    return this.characters.findByUsername(username);
  }
}
