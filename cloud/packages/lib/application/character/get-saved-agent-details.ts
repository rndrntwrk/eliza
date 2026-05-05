import { and, eq, ne, sql } from "drizzle-orm";
import { dbRead } from "@/db/client";
import { userCharacters } from "@/db/schemas";
import { memoryTable, participantTable, roomTable } from "@/db/schemas/eliza";
import { logger } from "@/lib/utils/logger";

export interface SavedAgentDetails {
  agent: {
    id: string;
    name: string;
    username: string | null;
    avatar_url: string | null;
    owner_id: string;
  };
  stats: {
    message_count: number;
    room_count: number;
  };
}

export class GetSavedAgentDetailsUseCase {
  async execute(
    userId: string,
    agentId: string,
  ): Promise<SavedAgentDetails | undefined> {
    logger.debug("[Characters] Getting saved agent details:", {
      userId,
      agentId,
    });

    const agent = await dbRead.query.userCharacters.findFirst({
      where: and(
        eq(userCharacters.id, agentId),
        ne(userCharacters.user_id, userId),
        eq(userCharacters.is_public, true),
      ),
    });
    if (!agent) {
      return undefined;
    }

    const messageResult = await dbRead
      .select({ count: sql<number>`count(*)` })
      .from(memoryTable)
      .where(
        and(eq(memoryTable.entityId, userId), eq(memoryTable.agentId, agentId)),
      );
    const messageCount = messageResult[0]?.count ?? 0;

    const roomResult = await dbRead
      .select({ count: sql<number>`count(*)` })
      .from(roomTable)
      .innerJoin(participantTable, eq(roomTable.id, participantTable.roomId))
      .where(
        and(
          eq(roomTable.agentId, agentId),
          eq(participantTable.entityId, userId),
        ),
      );
    const roomCount = roomResult[0]?.count ?? 0;

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        username: agent.username,
        avatar_url: agent.avatar_url,
        owner_id: agent.user_id,
      },
      stats: {
        message_count: Number(messageCount),
        room_count: Number(roomCount),
      },
    };
  }
}
