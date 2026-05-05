import { and, eq } from "drizzle-orm";
import { dbWrite } from "@/db/client";
import { elizaRoomCharactersTable } from "@/db/schemas";
import type { CharacterRepository } from "@/lib/domain/character/character-repository";
import { logger } from "@/lib/utils/logger";
import { IsClaimableAffiliateCharacterUseCase } from "./is-claimable-affiliate-character";
import type { UserRepository } from "@/lib/domain/user/user-repository";

export interface ClaimResult {
  success: boolean;
  message: string;
}

export class ClaimAffiliateCharacterUseCase {
  private readonly isClaimable: IsClaimableAffiliateCharacterUseCase;

  constructor(
    private readonly characters: CharacterRepository,
    users: UserRepository,
  ) {
    this.isClaimable = new IsClaimableAffiliateCharacterUseCase(
      characters,
      users,
    );
  }

  async execute(
    characterId: string,
    userId: string,
    organizationId: string,
  ): Promise<ClaimResult> {
    const claimCheck = await this.isClaimable.execute(characterId);
    if (!claimCheck.claimable) {
      logger.info(
        `[Characters] Character ${characterId} not claimable: ${claimCheck.reason}`,
      );
      return {
        success: false,
        message: claimCheck.reason || "Not claimable",
      };
    }

    const previousOwnerId = claimCheck.ownerId;
    logger.info(
      `[Characters] 🎯 Claiming affiliate character ${characterId} for user ${userId}`,
      { previousOwnerId },
    );

    const updated = await this.characters.update(characterId, {
      user_id: userId,
      organization_id: organizationId,
    });
    if (!updated) {
      return { success: false, message: "Failed to update character" };
    }

    if (previousOwnerId) {
      const roomUpdateResult = await dbWrite
        .update(elizaRoomCharactersTable)
        .set({ user_id: userId, updated_at: new Date() })
        .where(
          and(
            eq(elizaRoomCharactersTable.character_id, characterId),
            eq(elizaRoomCharactersTable.user_id, previousOwnerId),
          ),
        )
        .returning({ room_id: elizaRoomCharactersTable.room_id });

      if (roomUpdateResult.length > 0) {
        logger.info(
          `[Characters] Transferred ${roomUpdateResult.length} room association(s)`,
          {
            characterId,
            fromUserId: previousOwnerId,
            toUserId: userId,
          },
        );
      }
    }

    logger.info(
      `[Characters] ✅ Successfully claimed character ${characterId}`,
      {
        characterName: updated.name,
        newOwnerId: userId,
        newOrgId: organizationId,
      },
    );

    return {
      success: true,
      message: `Character "${updated.name}" has been added to your account`,
    };
  }
}
