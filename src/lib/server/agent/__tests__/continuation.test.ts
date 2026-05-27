import { describe, it, expect } from "vitest";
import { stepsToMessages } from "../index";

describe("stepsToMessages", () => {
  it("converts a step with text only", () => {
    const steps = [
      {
        content: [{ type: "text", text: "Hello" }],
        toolResults: [],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    expect(messages).toEqual([
      {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      },
    ]);
  });

  it("converts a step with tool calls and results into assistant + tool messages", () => {
    const steps = [
      {
        content: [
          { type: "text", text: "Searching..." },
          {
            type: "tool-call",
            toolCallId: "call_1",
            toolName: "search",
            input: { query: "test" },
          },
        ],
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: '{"results": []}',
          },
        ],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      role: "assistant",
      content: [
        { type: "text", text: "Searching..." },
        {
          type: "tool-call",
          toolCallId: "call_1",
          toolName: "search",
          input: { query: "test" },
        },
      ],
    });
    expect(messages[1]).toEqual({
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
  });

  it("skips assistant message when step has no content parts", () => {
    const steps = [
      {
        content: [],
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: "ok",
          },
        ],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    expect(messages).toEqual([
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: { type: "text", value: "ok" },
          },
        ],
      },
    ]);
  });

  it("handles multiple steps", () => {
    const steps = [
      {
        content: [
          {
            type: "tool-call",
            toolCallId: "call_1",
            toolName: "search",
            input: { query: "a" },
          },
        ],
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: "result_a",
          },
        ],
      } as any,
      {
        content: [{ type: "text", text: "Done" }],
        toolResults: [],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    // Step 1: assistant(tool-call) + tool(results) = 2 messages
    // Step 2: assistant(text) = 1 message
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe("assistant");
    expect(messages[1].role).toBe("tool");
    expect(messages[2].role).toBe("assistant");
  });

  it("stringifies non-string tool output", () => {
    const steps = [
      {
        content: [],
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: { key: "value" },
          },
        ],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    expect(messages[0].content[0].output).toEqual({
      type: "text",
      value: '{"key":"value"}',
    });
  });
});
