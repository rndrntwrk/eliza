import { describe, expect, it } from "vitest";
import {
  ALICE_CAMERA_DISTANCE_SCALE,
  APP_VRM_ASSET_NAMESPACE,
  buildAppVrmAssets,
} from "./character-catalog";

describe("Alice app VRM boot assets", () => {
  it("keeps the app boot roster pointed at the bundled milady Alice assets", () => {
    const assets = buildAppVrmAssets([
      { avatarIndex: 1, name: "Eliza" },
      { avatarIndex: 9, name: "Alice" },
    ] as Parameters<typeof buildAppVrmAssets>[0]);

    expect(APP_VRM_ASSET_NAMESPACE).toBe("milady");
    expect(assets).toContainEqual({
      title: "Alice",
      slug: "milady-9",
      cameraDistanceScale: ALICE_CAMERA_DISTANCE_SCALE,
    });
    expect(assets).not.toContainEqual(
      expect.objectContaining({ slug: "eliza-9" }),
    );
  });
});
