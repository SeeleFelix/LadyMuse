import { describe, it, expect } from "vitest";
import {
  parseToolDetail,
  extractToolResultText,
  buildApiMessages,
  type ChatMessage,
} from "../build-api-messages";

const toolDetailWithResult = (
  name: string,
  toolCallId: string,
  input: any,
  result: string,
) =>
  JSON.stringify({ name, input, toolCallId }, null, 2) +
  "\n\n--- 结果 ---\n" +
  result;

describe("parseToolDetail", () => {
  it("parses JSON before result marker", () => {
    const raw =
      '{"name": "search", "input": {"q": "test"}, "toolCallId": "call_1"}\n\n--- 结果 ---\n{"found": true}';
    const result = parseToolDetail(raw);
    expect(result).toEqual({
      name: "search",
      input: { q: "test" },
      toolCallId: "call_1",
    });
  });

  it("parses JSON without result marker", () => {
    const result = parseToolDetail('{"name": "search", "input": {}}');
    expect(result).toEqual({ name: "search", input: {} });
  });

  it("returns null for undefined", () => {
    expect(parseToolDetail(undefined)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseToolDetail("not json")).toBeNull();
  });
});

describe("extractToolResultText", () => {
  it("extracts text after result marker", () => {
    const raw = '{"name": "x"}\n\n--- 结果 ---\n{"data": 1}';
    expect(extractToolResultText(raw)).toBe('{"data": 1}');
  });

  it("returns empty string when no marker", () => {
    expect(extractToolResultText('{"name": "x"}')).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(extractToolResultText(undefined)).toBe("");
  });
});

describe("buildApiMessages", () => {
  it("converts simple user/assistant exchange", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ];

    const result = buildApiMessages(messages);

    expect(result).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: [{ type: "text", text: "hi there" }] },
    ]);
  });

  it("converts assistant with tool calls into assistant + tool messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "search for cats" },
      { role: "assistant", content: "" },
      {
        role: "tool",
        content: "🔍 Search...",
        toolDetail: toolDetailWithResult(
          "search",
          "call_1",
          { q: "cats" },
          '{"results": []}',
        ),
        toolCallId: "call_1",
      },
      { role: "assistant", content: "" },
      { role: "assistant", content: "Found nothing" },
    ];

    const result = buildApiMessages(messages);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: "user", content: "search for cats" });
    // Assistant with tool-call
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toContainEqual({
      type: "tool-call",
      toolCallId: "call_1",
      toolName: "search",
      input: { q: "cats" },
    });
    // Tool result message
    expect(result[2]).toEqual({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call_1",
          toolName: "search",
          output: { type: "text", value: '{"results": []}' },
        },
      ],
    });
    // Final assistant text
    expect(result[3]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "Found nothing" }],
    });
  });

  it("includes the last user message (the slice bug regression test)", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "first request" },
      { role: "assistant", content: "response" },
      { role: "user", content: "follow up" },
    ];

    // Simulating the real usage: messages.slice(0, -1) removes the empty assistant placeholder
    // But even without slicing, the last user message must be included
    const result = buildApiMessages(messages);

    const lastMsg = result[result.length - 1];
    expect(lastMsg).toEqual({ role: "user", content: "follow up" });
  });

  it("handles messages.slice(0, -1) to exclude trailing empty assistant", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "done" },
      { role: "user", content: "continue" },
      { role: "assistant", content: "" }, // placeholder, excluded by slice(0, -1)
    ];

    const result = buildApiMessages(messages.slice(0, -1));

    expect(result).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: [{ type: "text", text: "done" }] },
      { role: "user", content: "continue" },
    ]);
  });

  it("handles multiple tool calls from different steps", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "search" },
      { role: "assistant", content: "" },
      {
        role: "tool",
        content: "🔍 A...",
        toolDetail: toolDetailWithResult(
          "tool_a",
          "call_1",
          { x: 1 },
          "result_a",
        ),
        toolCallId: "call_1",
      },
      { role: "assistant", content: "" },
      {
        role: "tool",
        content: "🔍 B...",
        toolDetail: toolDetailWithResult(
          "tool_b",
          "call_2",
          { y: 2 },
          "result_b",
        ),
        toolCallId: "call_2",
      },
      { role: "assistant", content: "done" },
    ];

    const result = buildApiMessages(messages);

    // Both tool calls are grouped under the first assistant (empty assistants are skipped)
    // user, assistant(tool-call a + b), tool(results a + b), assistant(text)
    expect(result).toHaveLength(4);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toContainEqual(
      expect.objectContaining({ type: "tool-call", toolCallId: "call_1" }),
    );
    expect(result[1].content).toContainEqual(
      expect.objectContaining({ type: "tool-call", toolCallId: "call_2" }),
    );
    expect(result[2].role).toBe("tool");
    expect(result[2].content).toHaveLength(2);
    expect(result[3].role).toBe("assistant");
  });

  it("falls back to toolCallId from toolDetail JSON when message has no toolCallId", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "search" },
      { role: "assistant", content: "" },
      {
        role: "tool",
        content: "🔍 Search...",
        toolDetail: toolDetailWithResult("search", "call_99", {}, "ok"),
        // no toolCallId on the message — simulates DB-loaded messages
      },
      { role: "assistant", content: "done" },
    ];

    const result = buildApiMessages(messages);

    // tool-call and tool-result should both use "call_99"
    const toolCall = result[1].content.find((c: any) => c.type === "tool-call");
    const toolResult = result[2].content[0];
    expect(toolCall.toolCallId).toBe("call_99");
    expect(toolResult.toolCallId).toBe("call_99");
  });

  it("skips empty assistant with no tool calls", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "" }, // empty, no tools → omitted
      { role: "user", content: "hello again" },
    ];

    const result = buildApiMessages(messages);

    expect(result).toEqual([
      { role: "user", content: "hi" },
      { role: "user", content: "hello again" },
    ]);
  });
});
