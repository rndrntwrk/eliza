import { Hono } from "hono";
import { requireUserOrApiKeyWithOrg } from "@/lib/auth/workers-hono-auth";
import {
  RateLimitPresets,
  rateLimit,
} from "@/lib/middleware/rate-limit-hono-cloudflare";
import { appsService } from "@/lib/services/apps";
import { logger } from "@/lib/utils/logger";
import type { AppEnv } from "@/types/cloud-worker-env";

const app = new Hono<AppEnv>();

app.post("/", rateLimit(RateLimitPresets.STRICT), async (c) => {
  try {
    const user = await requireUserOrApiKeyWithOrg(c);
    const id = c.req.param("id") ?? "";

    const existingApp = await c.var.deps.getAppById.execute(id);

    if (!existingApp) {
      return c.json({ success: false, error: "App not found" }, 404);
    }

    if (existingApp.organization_id !== user.organization_id) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    const newApiKey = await appsService.regenerateApiKey(id);

    logger.info(`Regenerated API key for app: ${id}`, {
      appId: id,
      userId: user.id,
      organizationId: user.organization_id,
    });

    return c.json({
      success: true,
      apiKey: newApiKey,
      message:
        "API key regenerated successfully. Make sure to save it securely.",
    });
  } catch (error) {
    logger.error("Failed to regenerate API key:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to regenerate API key",
      },
      500,
    );
  }
});

export default app;
