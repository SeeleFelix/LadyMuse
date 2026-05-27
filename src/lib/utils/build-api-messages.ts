export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolDetail?: string;
  toolCallId?: string;
}

export function parseToolDetail(
  raw: string | undefined,
): { name: string; input: any; toolCallId?: string } | null {
  if (!raw) return null;
  try {
    const resultMarker = raw.indexOf("\n\n--- 结果 ---\n");
    const jsonPart = resultMarker >= 0 ? raw.slice(0, resultMarker) : raw;
    return JSON.parse(jsonPart);
  } catch {
    return null;
  }
}

export function extractToolResultText(raw: string | undefined): string {
  if (!raw) return "";
  const marker = "\n\n--- 结果 ---\n";
  const idx = raw.indexOf(marker);
  if (idx < 0) return "";
  return raw.slice(idx + marker.length);
}

export function buildApiMessages(
  localMessages: ChatMessage[],
): Array<Record<string, any>> {
  const result: Array<Record<string, any>> = [];
  let i = 0;

  while (i < localMessages.length) {
    const msg = localMessages[i];

    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
      i++;
    } else if (msg.role === "assistant") {
      const toolCalls: Array<Record<string, any>> = [];
      const toolResults: Array<Record<string, any>> = [];

      let j = i + 1;
      while (
        j < localMessages.length &&
        (localMessages[j].role === "tool" ||
          (localMessages[j].role === "assistant" &&
            !localMessages[j].content.trim()))
      ) {
        if (localMessages[j].role === "tool") {
          const tool = localMessages[j];
          const detail = parseToolDetail(tool.toolDetail);
          if (detail) {
            const tcId = tool.toolCallId || detail.toolCallId || `tc_${j}`;
            toolCalls.push({
              type: "tool-call",
              toolCallId: tcId,
              toolName: detail.name,
              input: detail.input,
            });
            const resultText = extractToolResultText(tool.toolDetail);
            toolResults.push({
              type: "tool-result",
              toolCallId: tcId,
              toolName: detail.name,
              output: { type: "text", value: resultText },
            });
          }
        }
        j++;
      }

      const content: Array<Record<string, any>> = [];
      if (msg.content.trim()) {
        content.push({ type: "text", text: msg.content });
      }
      content.push(...toolCalls);

      if (content.length > 0) {
        result.push({ role: "assistant", content });
      }

      if (toolResults.length > 0) {
        result.push({ role: "tool", content: toolResults });
      }

      i = j;
    } else {
      i++;
    }
  }

  return result;
}
