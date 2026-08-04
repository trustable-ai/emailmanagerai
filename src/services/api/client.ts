// App <-> backend LLM streaming.
//
// The frontend holds the real Gmail data, so only generative AI tasks are sent
// to the OpenServerless `v1/chat` action in `mode: "generate"`. The action
// streams markdown back over the platform streaming endpoint. Data and
// mutations are performed against the Gmail API directly (see services/gmail).

/**
 * Stream a generative AI turn. Yields incremental text chunks.
 */
export async function* streamGenerate(
  prompt: string,
  context: string,
  history: { role: string; content: string }[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch("/stream/web/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "generate", prompt, context, messages: history }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") yield parsed;
      } catch {
        /* ignore non-JSON lines */
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      const parsed = JSON.parse(tail);
      if (typeof parsed === "string") yield parsed;
    } catch {
      /* ignore */
    }
  }
}