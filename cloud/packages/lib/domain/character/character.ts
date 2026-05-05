import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { userCharacters } from "@/db/schemas/user-characters";

export type UserCharacter = InferSelectModel<typeof userCharacters>;
export type NewUserCharacter = InferInsertModel<typeof userCharacters>;
