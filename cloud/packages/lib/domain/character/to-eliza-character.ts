import type { ElizaCharacter } from "@/lib/types/eliza-character";
import type { UserCharacter } from "./character";

export function toElizaCharacter(character: UserCharacter): ElizaCharacter {
  const characterData = character.character_data as
    | Record<string, unknown>
    | undefined;
  const affiliateData = characterData?.affiliate as
    | { vibe?: string; affiliateId?: string; [key: string]: unknown }
    | undefined;

  const loreData = characterData?.lore as string[] | undefined;

  const settings = character.settings as
    | Record<string, string | boolean | number | Record<string, unknown>>
    | undefined;
  const mergedSettings = {
    ...settings,
    avatarUrl: character.avatar_url ?? undefined,
    ...(affiliateData || loreData
      ? {
          affiliateData: {
            ...affiliateData,
            lore: loreData,
          },
        }
      : {}),
  };

  return {
    id: character.id,
    name: character.name,
    username: character.username ?? undefined,
    system: character.system ?? undefined,
    bio: character.bio,
    messageExamples: (() => {
      const examples = character.message_examples;
      if (
        Array.isArray(examples) &&
        examples.every(
          (ex) =>
            Array.isArray(ex) &&
            ex.every(
              (msg) =>
                typeof msg === "object" &&
                msg !== null &&
                "name" in msg &&
                "content" in msg,
            ),
        )
      ) {
        return examples as ElizaCharacter["messageExamples"];
      }
      return undefined;
    })(),
    postExamples: character.post_examples as string[] | undefined,
    topics: character.topics as string[] | undefined,
    adjectives: character.adjectives as string[] | undefined,
    knowledge: character.knowledge as
      | (string | { path: string; shared?: boolean })[]
      | undefined,
    plugins: character.plugins as string[] | undefined,
    settings: mergedSettings as
      | Record<string, string | number | boolean | Record<string, unknown>>
      | undefined,
    secrets: character.secrets as
      | Record<string, string | number | boolean>
      | undefined,
    style: character.style as
      | { all?: string[]; chat?: string[]; post?: string[] }
      | undefined,
    avatarUrl: character.avatar_url ?? undefined,
    isPublic: character.is_public,
  };
}
