import { useCallback } from "react";
import { useAuth } from "@/services/auth/AuthContext";
import { useMailUI } from "@/store/MailContext";
import { useMailAction } from "@/hooks/useMailbox";
import {
  b64urlEncodeStr,
  listMessages,
  modifyMessage,
  sendMessage,
  trashMessage,
  untrashMessage,
} from "@/services/gmail/gmailClient";
import type { Email } from "@/lib/types";
import type { LabelIndex } from "@/services/gmail/gmailMapper";
import { toast } from "sonner";

/**
 * Real graphical actions against the Gmail API. Every action mirrors into the
 * AI conversation (UI <-> chat sync) and refreshes the mailbox.
 */
export function useEmailActions() {
  const { accessToken, user } = useAuth();
  const { labelIndex } = useMailUI();
  const action = useMailAction(accessToken);
  const { pushMessage, notify, setSelectedId } = useMailUI();
  const token = accessToken;
  const idx = labelIndex as LabelIndex | null;

  const note = useCallback(
    (msg: string, kind: "action" | "error" = "action") => {
      notify({ title: msg, variant: kind === "error" ? "error" : "success" });
      toast.success(msg);
      pushMessage({ role: "assistant", content: msg, kind });
    },
    [notify, pushMessage],
  );

  const run = useCallback(
    async (fn: () => Promise<void>, msg: string) => {
      try {
        await action.mutateAsync(fn);
        note(msg);
      } catch (e) {
        const text = e instanceof Error ? e.message : "Action failed";
        notify({ title: text, variant: "error" });
        toast.error(text);
        pushMessage({ role: "assistant", content: `⚠️ ${text}`, kind: "error" });
      }
    },
    [action, note, notify, pushMessage],
  );

  const labelId = (name: string): string | undefined =>
    idx?.byName[name.toLowerCase()]?.id || idx?.byName[name]?.id;

  const archive = useCallback(
    (e: Email) => run(() => modifyMessage(token!, e.id, [], ["INBOX"]), `Archived “${e.subject || e.id}”.`),
    [run, token],
  );
  const remove = useCallback(
    (e: Email) => run(() => trashMessage(token!, e.id), `Moved “${e.subject || e.id}” to Trash.`),
    [run, token],
  );
  const restore = useCallback(
    (e: Email) =>
      run(async () => {
        await untrashMessage(token!, e.id);
        await modifyMessage(token!, e.id, ["INBOX"], ["TRASH"]);
      }, `Restored “${e.subject || e.id}” to Inbox.`),
    [run, token],
  );
  const toggleRead = useCallback(
    (e: Email) =>
      run(
        () => modifyMessage(token!, e.id, e.read ? ["UNREAD"] : [], e.read ? [] : ["UNREAD"]),
        `Marked “${e.subject || e.id}” as ${e.read ? "unread" : "read"}.`,
      ),
    [run, token],
  );
  const toggleStar = useCallback(
    (e: Email) =>
      run(() => modifyMessage(token!, e.id, e.starred ? [] : ["STARRED"], e.starred ? ["STARRED"] : []),
        `${e.starred ? "Unstarred" : "Starred"} “${e.subject || e.id}”.`),
    [run, token],
  );
  const togglePin = useCallback(
    (e: Email) =>
      run(() => modifyMessage(token!, e.id, e.pinned ? [] : ["IMPORTANT"], e.pinned ? ["IMPORTANT"] : []),
        `${e.pinned ? "Unpinned" : "Pinned"} “${e.subject || e.id}”.`),
    [run, token],
  );
  const move = useCallback(
    (e: Email, folder: string) =>
      run(async () => {
        if (folder === "trash") {
          await trashMessage(token!, e.id);
        } else if (folder === "spam") {
          await modifyMessage(token!, e.id, ["SPAM"], ["INBOX"]);
        } else if (folder === "inbox") {
          await untrashMessage(token!, e.id);
          await modifyMessage(token!, e.id, ["INBOX"], ["SPAM", "TRASH"]);
        } else if (folder === "archive") {
          await modifyMessage(token!, e.id, [], ["INBOX"]);
        } else {
          const id = labelId(folder);
          if (id) await modifyMessage(token!, e.id, [id], ["INBOX"]);
        }
      }, `Moved “${e.subject || e.id}” to ${folder}.`),
    [run, token, labelId],
  );
  const addLabel = useCallback(
    (e: Email, label: string) => {
      const id = labelId(label);
      if (!id) {
        note(`Label “${label}” not found in your Gmail.`, "error");
        return Promise.resolve();
      }
      return run(() => modifyMessage(token!, e.id, [id], []), `Labeled “${e.subject || e.id}” as ${label}.`);
    },
    [run, token, labelId, note],
  );
  const removeLabel = useCallback(
    (e: Email, label: string) => {
      const id = labelId(label);
      if (!id) return Promise.resolve();
      return run(() => modifyMessage(token!, e.id, [], [id]), `Removed label “${label}” from “${e.subject || e.id}”.`);
    },
    [run, token, labelId],
  );
  const send = useCallback(
    (to: string, subject: string, body: string) => {
      const from = user?.email ? `${user.name || ""} <${user.email}>` : "";
      const rfc = [
        to ? `To: ${to}` : "",
        from ? `From: ${from}` : "",
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=UTF-8",
        "",
        body,
      ].filter((l, i) => !(i === 0 && l === "")).join("\n");
      const raw = b64urlEncodeStr(rfc);
      return run(() => sendMessage(token!, raw).then(() => {}), `Message sent to ${to || "—"}.`);
    },
    [run, token, user],
  );
  const deleteSpam = useCallback(() => {
    return run(async () => {
      const refs = await listMessages(token!, { labelIds: ["SPAM"], max: 100 });
      // Trashing spam empties the Spam folder (Gmail has no permanent-delete in modify scope).
      for (const r of refs) await trashMessage(token!, r.id);
    }, `Moved ${0} spam email(s) to Trash.`);
  }, [run, token]);

  return {
    run,
    archive,
    remove,
    restore,
    toggleRead,
    toggleStar,
    togglePin,
    move,
    addLabel,
    removeLabel,
    send,
    deleteSpam,
    setSelectedId,
    isPending: action.isPending,
  };
}