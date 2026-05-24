import { describe, expect, it } from "vitest";
import { parseConversationMessageEvent } from "./parsers";

describe("parseConversationMessageEvent operator action blocks", () => {
  it("preserves valid action-pill blocks from live websocket messages", () => {
    const message = parseConversationMessageEvent({
      id: "msg-1",
      role: "assistant",
      text: "Started stream",
      timestamp: 1_773_200_000,
      source: "operator_action",
      blocks: [
        {
          type: "action-pill",
          label: "Go Live",
          kind: "stream",
          detail: "YouTube",
        },
      ],
    });

    expect(message).toMatchObject({
      id: "msg-1",
      role: "assistant",
      text: "Started stream",
      timestamp: 1_773_200_000,
      source: "operator_action",
      blocks: [
        {
          type: "action-pill",
          label: "Go Live",
          kind: "stream",
          detail: "YouTube",
        },
      ],
    });
  });

  it("drops invalid blocks instead of leaking untyped UI payloads", () => {
    const message = parseConversationMessageEvent({
      id: "msg-2",
      role: "assistant",
      text: "Started stream",
      timestamp: 1_773_200_000,
      blocks: [
        {
          type: "action-pill",
          label: "Go Live",
          kind: "unknown",
        },
      ],
    });

    expect(message?.blocks).toBeUndefined();
  });
});
