import type { UserCharacter } from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class ListCharactersByUserUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(
    userId: string,
    options?: { includeTemplates?: boolean; source?: "cloud" },
  ): Promise<UserCharacter[]> {
    const source = options?.source ?? "cloud";
    if (options?.includeTemplates) {
      const [userChars, templates] = await Promise.all([
        this.characters.listByUser(userId, source),
        this.characters.listTemplates(),
      ]);
      return [...userChars, ...templates];
    }
    return this.characters.listByUser(userId, source);
  }
}
