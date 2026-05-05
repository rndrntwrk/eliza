import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class DeleteCharacterUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  execute(id: string): Promise<void> {
    return this.characters.delete(id);
  }
}
