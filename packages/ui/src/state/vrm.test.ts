import {
  buildElizaCharacterCatalog,
  DEFAULT_VISUAL_AVATAR_INDEX,
  DEFAULT_VISUAL_STYLE_PRESET_ID,
  DEFAULT_VISUAL_STYLE_PRESET_NAME,
  getStylePresets,
} from "@elizaos/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setBootConfig } from "../config/boot-config";
import {
  getDefaultBundledVrmIndex,
  getVrmBackgroundUrl,
  getVrmPreviewUrl,
  getVrmTitle,
  getVrmUrl,
  normalizeAvatarIndex,
} from "./vrm";
import { loadAvatarIndex, saveAvatarIndex } from "./persistence";

function configureMiladyRoster(): void {
  setBootConfig({
    branding: {},
    vrmAssets: getStylePresets()
      .slice()
      .sort((left, right) => left.avatarIndex - right.avatarIndex)
      .map((preset) => ({
        title: preset.name,
        slug: `milady-${preset.avatarIndex}`,
      })),
  });
}

describe("Alice VRM roster contract", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      removeItem: (key: string) => {
        storage.delete(key);
      },
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      get length() {
        return storage.size;
      },
    });
  });

  afterEach(() => {
    setBootConfig({ branding: {} });
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("publishes Alice as the default visual style preset", () => {
    const alice = getStylePresets().find(
      (preset) => preset.id === DEFAULT_VISUAL_STYLE_PRESET_ID,
    );

    expect(DEFAULT_VISUAL_STYLE_PRESET_ID).toBe("alice");
    expect(DEFAULT_VISUAL_STYLE_PRESET_NAME).toBe("Alice");
    expect(DEFAULT_VISUAL_AVATAR_INDEX).toBe(9);
    expect(alice).toMatchObject({
      id: "alice",
      name: "Alice",
      avatarIndex: 9,
    });
  });

  it("builds a milady-9 Alice asset for boot-time character catalogs", () => {
    const catalog = buildElizaCharacterCatalog();

    expect(catalog.assets).toContainEqual(
      expect.objectContaining({
        id: 9,
        slug: "milady-9",
        title: "Alice",
      }),
    );
  });

  it("keeps Alice selected and preserves custom avatar index 0", () => {
    configureMiladyRoster();

    expect(getDefaultBundledVrmIndex()).toBe(9);
    expect(normalizeAvatarIndex(Number.NaN)).toBe(9);
    expect(normalizeAvatarIndex(999)).toBe(9);
    expect(normalizeAvatarIndex(9)).toBe(9);
    expect(normalizeAvatarIndex(0)).toBe(0);
    expect(loadAvatarIndex()).toBe(9);

    localStorage.setItem("eliza_avatar_index", "1");
    localStorage.removeItem("eliza_avatar_default_index");
    expect(loadAvatarIndex()).toBe(9);
    expect(localStorage.getItem("eliza_avatar_index")).toBe("9");

    saveAvatarIndex(1);
    expect(loadAvatarIndex()).toBe(1);

    localStorage.setItem("eliza_avatar_index", "999");
    expect(loadAvatarIndex()).toBe(9);
  });

  it("resolves Alice URL, preview, background, and title metadata", () => {
    configureMiladyRoster();

    expect(getVrmUrl(999)).toBe("/vrms/milady-9.vrm.gz");
    expect(getVrmPreviewUrl(999)).toBe(
      "/vrms/previews/milady-9.png?v=20260413-alice-capture",
    );
    expect(getVrmBackgroundUrl(999)).toBe(
      "/vrms/backgrounds/milady-9.png?v=20260413-alice-capture",
    );
    expect(getVrmTitle(999)).toBe("Alice");
  });
});
