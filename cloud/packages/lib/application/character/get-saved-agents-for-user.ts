import { and, eq, ne, sql } from "drizzle-orm";
import { dbRead } from "@/db/client";
import { userCharacters, users } from "@/db/schemas";
import { memoryTable } from "@/db/schemas/eliza";
import { logger } from "@/lib/utils/logger";

export interface SavedAgent {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | string[] | null;
  owner_id: string;
  owner_name: string | null;
  last_interaction_time: string;
}

export class GetSavedAgentsForUserUseCase {
  async execute(userId: string): Promise<SavedAgent[]> {
    logger.debug("[Characters] Fetching saved agents for user:", { userId });

    const savedAgents = await dbRead
      .select({
        id: userCharacters.id,
        name: userCharacters.name,
        username: userCharacters.username,
        avatar_url: userCharacters.avatar_url,
        bio: userCharacters.bio,
        owner_id: userCharacters.user_id,
        owner_name: sql<
          string | null
        >`COALESCE(${users.name}, ${users.nickname})`.as("owner_name"),
        last_interaction_time: sql<string>`MAX(${memoryTable.createdAt})`.as(
          "last_interaction_time",
        ),
      })
      .from(memoryTable)
      .innerJoin(userCharacters, eq(memoryTable.agentId, userCharacters.id))
      .leftJoin(users, eq(userCharacters.user_id, users.id))
      .where(
        and(
          eq(memoryTable.entityId, userId),
          ne(userCharacters.user_id, userId),
          eq(userCharacters.is_public, true),
        ),
      )
      .groupBy(
        userCharacters.id,
        userCharacters.name,
        userCharacters.username,
        userCharacters.avatar_url,
        userCharacters.bio,
        userCharacters.user_id,
        users.name,
        users.nickname,
      )
      .orderBy(sql`MAX(${memoryTable.createdAt}) DESC`);

    logger.debug("[Characters] Found saved agents:", {
      userId,
      count: savedAgents.length,
    });

    return savedAgents;
  }
}
