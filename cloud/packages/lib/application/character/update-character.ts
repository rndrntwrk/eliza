import type {
  NewUserCharacter,
  UserCharacter,
} from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class UpdateCharacterUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  execute(
    id: string,
    data: Partial<NewUserCharacter>,
  ): Promise<UserCharacter | undefined> {
    return this.characters.update(id, data);
  }
}
