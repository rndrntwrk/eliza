import type { CharacterRepository } from "@/lib/domain/character/character-repository";
import type { UserRepository } from "@/lib/domain/user/user-repository";

export interface ClaimableResult {
  claimable: boolean;
  ownerId?: string;
  reason?: string;
}

export class IsClaimableAffiliateCharacterUseCase {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(characterId: string): Promise<ClaimableResult> {
    const character = await this.characters.findById(characterId);
    if (!character) {
      return { claimable: false, reason: "Character not found" };
    }

    const owner = await this.users.findById(character.user_id);
    if (!owner) {
      return { claimable: false, reason: "Owner not found" };
    }

    const isAffiliateUser =
      owner.email?.includes("@anonymous.elizacloud.ai") || false;
    const isAnonymous = owner.is_anonymous === true;
    const hasNoPrivyId = !owner.privy_user_id;

    if (isAffiliateUser && (isAnonymous || hasNoPrivyId)) {
      return {
        claimable: true,
        ownerId: owner.id,
        reason: "Affiliate character available for claiming",
      };
    }

    return {
      claimable: false,
      reason: "Character already owned by a real user",
    };
  }
}
