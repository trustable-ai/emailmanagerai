import { useCallback } from "react";
import { useMailAction } from "@/hooks/useMailbox";
import { useMailUI } from "@/store/MailContext";
import { toast } from "sonner";
import type { Email } from "@/lib/types";

/**
 * Performs a graphical UI action against the mailbox and mirrors it into the
 * AI conversation so the UI and chat stay synchronized. Every graphical action
 * also appears inside the conversation as an assistant-style system note.
 */
export function useEmailActions() {
  const action = useMailAction();
  const { pushMessage, notify, setSelectedId, clearMessages } = useMailUI();

  const run = useCallback(
    async (
      payload: { action: string; id?: string; folder?: string; label?: string; to?: string; subject?: string; body?: string },
      opts?: { toastMsg?: string; noteMsg?: string; chat?: boolean },
    ) => {
      const chat = opts?.chat !== false;
      try {
        const res = await action.mutateAsync(payload);
        const msg = opts?.noteMsg || res.message;
        if (msg) {
          notify({ title: msg, variant: "success" });
          toast.success(msg);
          if (chat) {
            pushMessage({ role: "assistant", content: msg, kind: "action" });
          }
        }
        return res;
      } catch (e) {
        const text = e instanceof Error ? e.message : "Action failed";
        notify({ title: text, variant: "error" });
        toast.error(text);
        if (chat) pushMessage({ role: "assistant", content: `⚠️ ${text}`, kind: "action" });
        throw e;
      }
    },
    [action, pushMessage, notify],
  );

  const archive = useCallback(
    (e: Email) => run({ action: "archive", id: e.id }, { noteMsg: `Archived ${e.id} — “${e.subject}”.` }),
    [run],
  );
  const remove = useCallback(
    (e: Email) =>
      run({ action: "delete", id: e.id }, { noteMsg: `Moved ${e.id} to Trash.` }),
    [run],
  );
  const restore = useCallback(
    (e: Email) => run({ action: "restore", id: e.id }, { noteMsg: `Restored ${e.id} to Inbox.` }),
    [run],
  );
  const toggleRead = useCallback(
    (e: Email) =>
      run(
        { action: e.read ? "mark_unread" : "mark_read", id: e.id },
        { noteMsg: `Marked ${e.id} as ${e.read ? "unread" : "read"}.` },
      ),
    [run],
  );
  const toggleStar = useCallback(
    (e: Email) =>
      run(
        { action: e.starred ? "unstar" : "star", id: e.id },
        { noteMsg: `${e.starred ? "Unstarred" : "Starred"} ${e.id}.` },
      ),
    [run],
  );
  const togglePin = useCallback(
    (e: Email) =>
      run(
        { action: e.pinned ? "unpin" : "pin", id: e.id },
        { noteMsg: `${e.pinned ? "Unpinned" : "Pinned"} ${e.id}.` },
      ),
    [run],
  );
  const move = useCallback(
    (e: Email, folder: string) =>
      run({ action: "move", id: e.id, folder }, { noteMsg: `Moved ${e.id} to ${folder}.` }),
    [run],
  );
  const addLabel = useCallback(
    (e: Email, label: string) =>
      run({ action: "label", id: e.id, label }, { noteMsg: `Labeled ${e.id} as ${label}.` }),
    [run],
  );
  const removeLabel = useCallback(
    (e: Email, label: string) =>
      run({ action: "unlabel", id: e.id, label }, { noteMsg: `Removed label ${label} from ${e.id}.` }),
    [run],
  );
  const send = useCallback(
    (to: string, subject: string, body: string) =>
      run(
        { action: "send", to, subject, body },
        { noteMsg: `Message sent to ${to || "—"}.` },
      ),
    [run],
  );
  const saveDraft = useCallback(
    (subject: string, body: string) =>
      run({ action: "save_draft", subject, body }, { noteMsg: "Draft saved." }),
    [run],
  );
  const deleteSpam = useCallback(
    () => run({ action: "delete_spam" }, { noteMsg: "Moved spam to Trash." }),
    [run],
  );
  const emptyTrash = useCallback(
    () => run({ action: "empty_trash" }, { noteMsg: "Emptied trash." }),
    [run],
  );

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
    saveDraft,
    deleteSpam,
    emptyTrash,
    setSelectedId,
    clearMessages,
    isPending: action.isPending,
  };
}