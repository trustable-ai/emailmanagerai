import { useCallback, useRef, useState } from "react";
import { streamGenerate } from "@/services/api/client";
import { useMailUI } from "@/store/MailContext";
import { useRefreshMail } from "@/hooks/useMailbox";
import { useAuth } from "@/services/auth/AuthContext";
import { routeAi, HELP_TEXT } from "@/services/ai/router";
import { listMessages, modifyMessage, trashMessage } from "@/services/gmail/gmailClient";
import type { Email } from "@/lib/types";
import { fullName, relativeTime } from "@/lib/mailUtils";

/** Render an email list as a compact markdown list for the chat. */
function listMarkdown(title: string, emails: Email[]): string {
  if (!emails.length) return `### ${title}\n_No results._`;
  const lines = [`### ${title}`, `_${emails.length} email(s)_`, ""];
  for (const e of emails.slice(0, 20)) {
    const flags = [!e.read && "unread", e.starred && "★", e.pinned && "📌"]
      .filter(Boolean)
      .join(" ");
    lines.push(
      `- **${fullName(e.from)}** — ${e.subject || "(no subject)"} _[${relativeTime(e.date)}]_ ${flags ? `· ${flags}` : ""}`,
    );
  }
  if (emails.length > 20) lines.push(`\n_…and ${emails.length - 20} more._`);
  return lines.join("\n");
}

export function useAIChat() {
  const {
    messages,
    pushMessage,
    updateMessage,
    clearMessages,
    selectedId,
    workspaceEmails,
    setActiveFolder,
  } = useMailUI();
  const { accessToken } = useAuth();
  const refresh = useRefreshMail(accessToken);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const selected = workspaceEmails.find((e) => e.id === selectedId);

  const runBulk = useCallback(
    async (action: "deleteSpam" | "archiveNewsletters" | "archiveAll"): Promise<string> => {
      const token = accessToken;
      if (!token) return "Not signed in.";
      if (action === "deleteSpam") {
        const refs = await listMessages(token, { labelIds: ["SPAM"], max: 100 });
        for (const r of refs) await trashMessage(token, r.id);
        return `Moved ${refs.length} spam email(s) to Trash.`;
      }
      if (action === "archiveNewsletters") {
        const refs = await listMessages(token, {
          labelIds: ["INBOX"],
          q: "category:promotions OR category:updates",
          max: 100,
        });
        for (const r of refs) await modifyMessage(token, r.id, [], ["INBOX"]);
        return `Archived ${refs.length} newsletter(s) from the inbox.`;
      }
      // archiveAll
      const refs = await listMessages(token, { labelIds: ["INBOX"], max: 100 });
      for (const r of refs) await modifyMessage(token, r.id, [], ["INBOX"]);
      return `Archived ${refs.length} inbox email(s).`;
    },
    [accessToken],
  );

  const send = useCallback(
    async (input: string) => {
      const text = input.trim();
      if (!text || isStreaming) return;

      const plan = routeAi(text, selected, workspaceEmails);
      pushMessage({ role: "user", content: text, kind: "ai" });

      if (plan.kind === "unknown") {
        pushMessage({ role: "assistant", content: HELP_TEXT, kind: "ai" });
        return;
      }

      if (plan.kind === "text") {
        pushMessage({ role: "assistant", content: plan.text, kind: "ai" });
        return;
      }

      if (plan.kind === "list") {
        pushMessage({ role: "assistant", content: listMarkdown(plan.title, plan.emails), kind: "ai" });
        return;
      }

      if (plan.kind === "bulk") {
        const ph = pushMessage({ role: "assistant", content: "Working on it…", kind: "action", pending: true });
        try {
          const msg = await runBulk(plan.action);
          updateMessage(ph.id, { content: msg, pending: false });
          void refresh();
        } catch (e) {
          updateMessage(ph.id, {
            content: `⚠️ ${e instanceof Error ? e.message : "Action failed"}`,
            pending: false,
          });
        }
        return;
      }

      // generative
      const ph = pushMessage({ role: "assistant", content: "", kind: "ai", pending: true });
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));
      let acc = "";
      try {
        for await (const chunk of streamGenerate(plan.prompt, plan.context, history, controller.signal)) {
          acc += chunk;
          updateMessage(ph.id, { content: acc, pending: true });
        }
        updateMessage(ph.id, { content: acc || "_(no response)_", pending: false });
      } catch (err) {
        if (controller.signal.aborted) {
          updateMessage(ph.id, { content: acc || "_stopped_", pending: false });
        } else {
          updateMessage(ph.id, {
            content: `⚠️ ${err instanceof Error ? err.message : "Failed to reach assistant"}`,
            pending: false,
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, selected, workspaceEmails, messages, pushMessage, updateMessage, runBulk, refresh],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearMessages();
  }, [clearMessages]);

  return { send, stop, reset, isStreaming, messages };
}