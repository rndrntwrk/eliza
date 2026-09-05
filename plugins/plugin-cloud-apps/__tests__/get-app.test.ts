/**
 * GET_APP action tests: single-app detail resolved by name or id. The @elizaos/cloud-sdk client is faked (helpers.ts, SDK boundary only); the action runs for real.
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  captureCallback,
  FakeElizaCloudClient,
  keyedRuntime,
  makeApp,
  makeMessage,
  requireDefined,
  resetSdk,
  setGetApp,
  setListApps,
  unkeyedRuntime,
} from "./helpers";

mock.module("@elizaos/cloud-sdk", () => ({
  ElizaCloudClient: FakeElizaCloudClient,
}));

const { getAppAction } = await import("../src/actions/get-app.ts");

const STALE_APP_ID = "00000000-0000-4000-8000-000000000099";
const OWNED_APP = makeApp({
  id: "00000000-0000-4000-8000-000000000001",
  name: "Acme Bot",
  slug: "acme-bot",
});

async function runIdLookupFailure(statusCode: number) {
  let listAppsCalls = 0;
  setGetApp(() =>
    Promise.reject(
      Object.assign(new Error(`HTTP ${statusCode}`), { statusCode }),
    ),
  );
  setListApps(() => {
    listAppsCalls += 1;
    return Promise.resolve({ success: true, apps: [OWNED_APP] });
  });
  const callback = captureCallback();
  const result = requireDefined(
    await getAppAction.handler(
      keyedRuntime(),
      makeMessage("tell me about that app"),
      undefined,
      { appId: STALE_APP_ID },
      callback.fn,
    ),
    "action result",
  );
  return { callback, listAppsCalls, result };
}

describe("GET_APP", () => {
  beforeEach(() => {
    resetSdk();
  });

  it("validates only when a Cloud API key is present", async () => {
    expect(await getAppAction.validate(keyedRuntime(), makeMessage("x"))).toBe(
      true,
    );
    expect(
      await getAppAction.validate(unkeyedRuntime(), makeMessage("x")),
    ).toBe(false);
  });

  it("resolves an app by name from free-text and formats its detail", async () => {
    setListApps(() =>
      Promise.resolve({
        success: true,
        apps: [
          makeApp({
            id: "id-acme",
            name: "Acme Bot",
            slug: "acme-bot",
            description: "Customer support bot",
            production_url: "https://acme.elizacloud.ai",
            deployment_status: "deployed",
            total_credits_used: "12.4",
            monetization_enabled: true,
            total_creator_earnings: "3.5",
          }),
          makeApp({ id: "id-other", name: "Other", slug: "other" }),
        ],
      }),
    );

    const cb = captureCallback();
    const result = await getAppAction.handler(
      keyedRuntime(),
      makeMessage("tell me about my Acme Bot app"),
      undefined,
      undefined,
      cb.fn,
    );

    expect(result?.success).toBe(true);
    const reply = cb.calls[0]?.text ?? "";
    expect(reply).toContain("Acme Bot");
    expect(reply).toContain("Customer support bot");
    expect(reply).toContain("https://acme.elizacloud.ai");
    expect(reply).toContain("deployed");
    expect(reply).toContain("$12.40");
    expect(reply).toContain("$3.50");
    expect(
      (requireDefined(result, "action result").data as { app: { id: string } })
        .app.id,
    ).toBe("id-acme");
  });

  it("resolves an app via an explicit planner option", async () => {
    setListApps(() =>
      Promise.resolve({
        success: true,
        apps: [makeApp({ id: "id-7", name: "Widget", slug: "widget" })],
      }),
    );
    const cb = captureCallback();
    const result = await getAppAction.handler(
      keyedRuntime(),
      makeMessage("show it"),
      undefined,
      { appName: "Widget" },
      cb.fn,
    );
    expect(result?.success).toBe(true);
    expect(cb.calls[0]?.text).toContain("Widget");
  });

  it("fetches by id directly when the reference is a UUID", async () => {
    const uuid = "11111111-2222-3333-4444-555555555555";
    let listCalled = false;
    setListApps(() => {
      listCalled = true;
      return Promise.resolve({ success: true, apps: [] });
    });
    setGetApp((id) =>
      Promise.resolve({
        success: true,
        app: makeApp({ id, name: "By Id App", slug: "by-id" }),
      }),
    );

    const cb = captureCallback();
    const result = await getAppAction.handler(
      keyedRuntime(),
      makeMessage(uuid),
      undefined,
      undefined,
      cb.fn,
    );

    expect(result?.success).toBe(true);
    expect(cb.calls[0]?.text).toContain("By Id App");
    // The id path must not fall back to listApps.
    expect(listCalled).toBe(false);
  });

  it("falls through to the owned-app list for a stale app id", async () => {
    const { callback, listAppsCalls, result } = await runIdLookupFailure(404);

    expect(result.success).toBe(false);
    expect(result.data).toMatchObject({
      reason: "not_found",
      reference: STALE_APP_ID,
    });
    expect(result.userFacingText).toContain("Acme Bot");
    expect(callback.calls).toHaveLength(1);
    expect(callback.calls[0]?.text).toBe(result.userFacingText);
    expect(listAppsCalls).toBe(1);
  });

  it("falls through to the owned-app list for a foreign app id", async () => {
    const { listAppsCalls, result } = await runIdLookupFailure(403);

    expect(result.success).toBe(false);
    expect(result.data).toMatchObject({ reason: "not_found" });
    expect(result.userFacingText).toContain("Acme Bot");
    expect(listAppsCalls).toBe(1);
  });

  it("keeps a direct lookup server failure distinct from not-found", async () => {
    const { listAppsCalls, result } = await runIdLookupFailure(500);

    expect(result.success).toBe(false);
    expect(result.data).toMatchObject({ reason: "error" });
    expect(listAppsCalls).toBe(0);
  });

  it("keeps a direct authentication failure distinct from not-found", async () => {
    const { listAppsCalls, result } = await runIdLookupFailure(401);

    expect(result.success).toBe(false);
    expect(result.data).toMatchObject({ reason: "error" });
    expect(listAppsCalls).toBe(0);
  });

  for (const statusCode of [403, 404]) {
    it(`does not treat a delivery ${statusCode} as an app lookup miss`, async () => {
      let listAppsCalls = 0;
      let deliveryCalls = 0;
      setGetApp(() => Promise.resolve({ success: true, app: OWNED_APP }));
      setListApps(() => {
        listAppsCalls += 1;
        return Promise.resolve({ success: true, apps: [] });
      });
      const deliveryError = Object.assign(new Error("Delivery failed"), {
        statusCode,
      });
      const cb = captureCallback();
      const result = requireDefined(
        await getAppAction.handler(
          keyedRuntime(),
          makeMessage(OWNED_APP.id),
          undefined,
          undefined,
          async (content) => {
            deliveryCalls += 1;
            if (deliveryCalls === 1) throw deliveryError;
            return cb.fn(content);
          },
        ),
        "action result",
      );

      expect(result.success).toBe(false);
      expect(result.data).toMatchObject({ reason: "error" });
      expect(result.error).toBe(deliveryError);
      expect(listAppsCalls).toBe(0);
      expect(cb.calls[0]?.text).toBe(result.userFacingText);
    });
  }

  it("returns a graceful not-found when nothing matches", async () => {
    setListApps(() =>
      Promise.resolve({
        success: true,
        apps: [makeApp({ name: "Acme Bot", slug: "acme-bot" })],
      }),
    );

    const cb = captureCallback();
    const result = await getAppAction.handler(
      keyedRuntime(),
      makeMessage("tell me about Zephyr"),
      undefined,
      undefined,
      cb.fn,
    );

    expect(result?.success).toBe(false);
    expect(
      (requireDefined(result, "action result").data as { reason: string })
        .reason,
    ).toBe("not_found");
    const reply = cb.calls[0]?.text ?? "";
    expect(reply).toContain("couldn't find an app");
    expect(reply).toContain("Acme Bot");
  });

  it("degrades gracefully when no Cloud API key is configured", async () => {
    const cb = captureCallback();
    const result = await getAppAction.handler(
      unkeyedRuntime(),
      makeMessage("tell me about my app"),
      undefined,
      undefined,
      cb.fn,
    );
    expect(result?.success).toBe(false);
    expect(
      (requireDefined(result, "action result").data as { reason: string })
        .reason,
    ).toBe("no_key");
    expect(cb.calls[0]?.text).toContain("no Cloud API key");
  });

  it("handles a Cloud API error without throwing", async () => {
    setListApps(() => Promise.reject(new Error("network")));
    const cb = captureCallback();
    const result = await getAppAction.handler(
      keyedRuntime(),
      makeMessage("tell me about something"),
      undefined,
      undefined,
      cb.fn,
    );
    expect(result?.success).toBe(false);
    expect(
      (requireDefined(result, "action result").data as { reason: string })
        .reason,
    ).toBe("error");
  });
});
