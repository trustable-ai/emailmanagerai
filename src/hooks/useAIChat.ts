import { useCallback, useRef, useState } from "react";
import { streamChat } from "@/services/api/client";
import { useMailUI } from "@/store/MailContext";
import { useRefreshMailbox } from "@/hooks/useMailbox";

/**
 * AI assistant streaming hook. Streams the assistant response token-by-token
 * into the chat panel, then re-syncs the mailbox snapshot so UI and chat stay
 * synchronized after any server-side mutation (archive/delete/star/...).
 */
export function useAIChat() {
  const { messages, pushMessage, updateMessage, clearMessages } = useMailUI();
  const refresh = useRefreshMailbox();
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (input: string) => {
      const text = input.trim();
      if (!text || isStreaming) return;

      pushMessage({ role: "user", content: text, kind: "ai" });
      const placeholder = pushMessage({
        role: "assistant",
        content: "",
        kind: "ai",
        pending: true,
      });

      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      // Build history from current conversation (user/assistant only).
      const history = [
        ...messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];

      let acc = "";
      try {
        for await (const chunk of streamChat(text, history, controller.signal)) {
          acc += chunk;
          updateMessage(placeholder.id, { content: acc, pending: true });
        }
        updateMessage(placeholder.id, {
          content: acc || "_(no response)_",
          pending: false,
        });
        // Re-sync mailbox so the graphical UI reflects any AI-driven change.
        void refresh();
      } catch (err) {
        if (controller.signal.aborted) {
          updateMessage(placeholder.id, {
            content: acc || "_stopped_",
            pending: false,
          });
        } else {
          const msg =
            err instanceof Error ? err.message : "Failed to reach assistant";
          updateMessage(placeholder.id, {
            content: `⚠️ ${msg}`,
            pending: false,
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, pushMessage, updateMessage, refresh],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearMessages();
  }, [clearMessages]);

  return { send, stop, reset, isStreaming, messages };
}