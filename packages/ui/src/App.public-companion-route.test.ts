import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = path.resolve(__dirname, "./App.tsx");

describe("App.tsx public /companion/ route bypass", () => {
  // Regression guard for the frontier companion contract: the base
  // /companion/ surface must render the CompanionShell without an auth
  // wall, an onboarding overlay, or a runtime-picker gate. Reverting
  // this bypass is what produces the symptom where /companion/ parks on
  // OnboardingUiOverlay and the avatar / Go Live / Action Log never
  // mount. The static-file server already classifies /companion/ as
  // public (see static-file-server.ts isPublicCompanionUiPath); the SPA
  // shell layer must classify the path the same way.
  const source = fs.readFileSync(appSource, "utf8");

  it("declares the isPublicCompanionRoute memo with the /companion/ pathname check", () => {
    expect(source).toMatch(
      /const\s+isPublicCompanionRoute\s*=\s*useMemo\(/,
    );
    expect(source).toMatch(
      /window\.location\.pathname\.replace\([^)]+\)\s*===\s*["']\/companion["']/,
    );
  });

  it("gates the StartupShell early-return on isPublicCompanionRoute", () => {
    // The startup gate must include `!isPublicCompanionRoute` so the
    // OnboardingUiOverlay / pairing view / login view do not preempt
    // the companion render path.
    const startupGuard =
      /!isPublicCompanionRoute\s*&&\s*\(\s*startupCoordinator\.phase\s*!==\s*"ready"\s*\|\|\s*!onboardingComplete\s*\)/;
    expect(source).toMatch(startupGuard);
  });

  it("gates the auth-status / LoginView block on isPublicCompanionRoute", () => {
    // The auth gate must include `!isPublicCompanionRoute` so that
    // unauthenticated /companion/ visitors do not see LoginView before
    // the companion shell can render.
    expect(source).toMatch(
      /isCoordinatorReady\s*&&\s*!isPopout\s*&&\s*!isPublicCompanionRoute/,
    );
  });
});
