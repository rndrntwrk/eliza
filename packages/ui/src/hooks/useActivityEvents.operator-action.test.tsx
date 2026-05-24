// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActivityEvents } from "./useActivityEvents";

type WsHandler = (data: Record<string, unknown>) => void;

const wsHandlers = new Map<string, WsHandler>();

vi.mock("../api", () => ({
  client: {
    onWsEvent: vi.fn((eventName: string, handler: WsHandler) => {
      wsHandlers.set(eventName, handler);
      return () => {
        wsHandlers.delete(eventName);
      };
    }),
  },
}));

function HookProbe(props: {
  onState: (result: ReturnType<typeof useActivityEvents>) => void;
}): null {
  const result = useActivityEvents();
  props.onState(result);
  return null;
}

beforeEach(() => {
  wsHandlers.clear();
  let rafId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    rafId += 1;
    window.setTimeout(() => callback(performance.now()), 0);
    return rafId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  wsHandlers.clear();
});

describe("useActivityEvents operator actions", () => {
  it("does not show operator_action proactive messages in the activity rail", async () => {
    const seen: ReturnType<typeof useActivityEvents>[] = [];
    render(<HookProbe onState={(result) => seen.push(result)} />);

    const proactiveHandler = wsHandlers.get("proactive-message");
    expect(proactiveHandler).toBeDefined();

    proactiveHandler?.({
      conversationId: "conversation-1",
      message: {
        id: "msg-1",
        role: "assistant",
        text: "Go Live",
        timestamp: Date.now(),
        source: "operator_action",
      },
    });

    proactiveHandler?.({
      message: "Regular proactive note",
    });

    await waitFor(() => {
      const last = seen[seen.length - 1];
      expect(last?.events).toHaveLength(1);
    });

    const last = seen[seen.length - 1];
    expect(last?.events[0]?.summary).toBe("Regular proactive note");
  });
});
