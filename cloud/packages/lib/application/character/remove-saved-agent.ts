import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { dbRead, dbWrite } from "@/db/client";
import { userCharacters } from "@/db/schemas";
import { memoryTable, participantTable, roomTable } from "@/db/schemas/eliza";
import { logger } from "@/lib/utils/logger";

export type RemoveSavedAgentResult =
  | {
      success: true;
      deleted: { memories: number; participants: number; rooms: number };
    }
  | { success: false; error: string };

export class RemoveSavedAgentUseCase {
  async execute(
    userId: string,
    agentId: string,
  ): Promise<RemoveSavedAgentResult> {
    logger.info("[Characters] Removing saved agent:", { userId, agentId });

    const agent = await dbRead.query.userCharacters.findFirst({
      where: and(
        eq(userCharacters.id, agentId),
        ne(userCharacters.user_id, userId),
      ),
    });
    if (!agent) {
      return { success: false, error: "Agent not found or you own this agent" };
    }

    const userRooms = await dbRead
      .select({ roomId: participantTable.roomId })
      .from(participantTable)
      .innerJoin(roomTable, eq(participantTable.roomId, roomTable.id))
      .where(
        and(
          eq(participantTable.entityId, userId),
          eq(roomTable.agentId, agentId),
        ),
      );
    const roomIds = userRooms.map((r) => r.roomId);

    const { deletedMemories, deletedParticipants, deletedRooms } =
      await dbWrite.transaction(async (tx) => {
        let memoryCount = 0;
        let participantCount = 0;
        let roomCount = 0;

        if (roomIds.length > 0) {
          const memoryResult = await tx
            .delete(memoryTable)
            .where(
              and(
                eq(memoryTable.entityId, userId),
                inArray(memoryTable.roomId, roomIds),
              ),
            )
            .returning({ id: memoryTable.id });
          memoryCount = memoryResult.length;

          const participantResult = await tx
            .delete(participantTable)
            .where(
              and(
                eq(participantTable.entityId, userId),
                inArray(participantTable.roomId, roomIds),
              ),
            )
            .returning({ id: participantTable.id });
          participantCount = participantResult.length;

          const roomParticipantCounts = await tx
            .select({
              roomId: participantTable.roomId,
              count: sql<number>`count(*)`.as("count"),
            })
            .from(participantTable)
            .where(inArray(participantTable.roomId, roomIds))
            .groupBy(participantTable.roomId);

          const participantCountMap = new Map(
            roomParticipantCounts.map((r) => [r.roomId, Number(r.count)]),
          );

          const emptyRoomIds = roomIds.filter(
            (roomId) =>
              !participantCountMap.has(roomId) ||
              participantCountMap.get(roomId) === 0,
          );

          if (emptyRoomIds.length > 0) {
            await tx
              .delete(roomTable)
              .where(inArray(roomTable.id, emptyRoomIds));
            roomCount = emptyRoomIds.length;
          }
        }

        const directMemoryResult = await tx
          .delete(memoryTable)
          .where(
            and(
              eq(memoryTable.entityId, userId),
              eq(memoryTable.agentId, agentId),
            ),
          )
          .returning({ id: memoryTable.id });
        memoryCount += directMemoryResult.length;

        return {
          deletedMemories: memoryCount,
          deletedParticipants: participantCount,
          deletedRooms: roomCount,
        };
      });

    logger.info("[Characters] Removed saved agent:", {
      userId,
      agentId,
      deletedMemories,
      deletedParticipants,
      deletedRooms,
    });

    return {
      success: true,
      deleted: {
        memories: deletedMemories,
        participants: deletedParticipants,
        rooms: deletedRooms,
      },
    };
  }
}
