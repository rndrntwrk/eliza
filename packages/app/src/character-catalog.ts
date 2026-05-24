import {
  buildElizaCharacterCatalog,
  DEFAULT_VISUAL_AVATAR_INDEX,
  getStylePresets,
  type StylePreset,
} from "@elizaos/shared";
import type { BundledVrmAsset, CharacterCatalogData } from "@elizaos/ui";

export const APP_VRM_ASSET_NAMESPACE = "milady";
export const ALICE_CAMERA_DISTANCE_SCALE = 1.3;

export function buildAppVrmAssets(
  stylePresets: readonly StylePreset[] = getStylePresets(),
): BundledVrmAsset[] {
  return stylePresets
    .slice()
    .sort((left, right) => left.avatarIndex - right.avatarIndex)
    .map((preset) => ({
      title: preset.name,
      slug: `${APP_VRM_ASSET_NAMESPACE}-${preset.avatarIndex}`,
      ...(preset.avatarIndex === DEFAULT_VISUAL_AVATAR_INDEX
        ? { cameraDistanceScale: ALICE_CAMERA_DISTANCE_SCALE }
        : {}),
    }));
}

export const APP_CHARACTER_CATALOG: CharacterCatalogData =
  buildElizaCharacterCatalog() as CharacterCatalogData;
