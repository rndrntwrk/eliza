import type { UserCharacter } from "@/lib/domain/character/character";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";

export class ListCharactersByOrganizationUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  execute(
    organizationId: string,
    options?: { source?: "cloud" },
  ): Promise<UserCharacter[]> {
    const source = options?.source ?? "cloud";
    return this.characters.listByOrganization(organizationId, source);
  }
}
