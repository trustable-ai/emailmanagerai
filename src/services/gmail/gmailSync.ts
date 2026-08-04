// High-level Gmail sync: load a folder's messages, folder counts, and threads.
import type { Email, Folder } from "@/lib/types";
import {
  getMessage,
  getThread,
  listLabels,
  listMessages,
  type GmailLabel,
  type GmailMessage,
} from "@/services/gmail/gmailClient";
import {
  buildLabelIndex,
  folderQuery,
  mapMessage,
  type LabelIndex,
} from "@/services/gmail/gmailMapper";

export interface MailboxLoadResult {
  emails: Email[];
  labels: GmailLabel[];
  labelIndex: LabelIndex;
}

const FOLDER_LABEL_IDS: Record<string, string> = {
  inbox: "INBOX",
  sent: "SENT",
  drafts: "DRAFT",
  spam: "SPAM",
  trash: "TRASH",
};

/**
 * Load the messages for a logical folder. Lists message refs then fetches each
 * with `metadata` (enough for the list view). Threads are fetched fully on
 * demand when an email is opened.
 */
export async function loadFolder(
  token: string,
  folder: Folder,
): Promise<MailboxLoadResult> {
  const labels = await listLabels(token);
  const labelIndex = buildLabelIndex(labels);
  const q = folderQuery(folder);
  const refs = await listMessages(token, { ...q, max: 60 });
  // Fetch each message's metadata in bounded parallelism.
  const messages = await pmap(refs, (r) => getMessage(token, r.id, "metadata"), 6);
  const emails = messages
    .map((m) => mapMessage(m, labelIndex))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { emails, labels: labels.filter((l) => l.type !== "system"), labelIndex };
}

/** Lightweight folder counts (unread for inbox, total for others). */
export async function loadFolderCounts(
  token: string,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {
    inbox: 0,
    starred: 0,
    important: 0,
    sent: 0,
    drafts: 0,
    spam: 0,
    trash: 0,
    archive: 0,
  };
  // Unread inbox count.
  const unreadInbox = await listMessages(token, { labelIds: ["INBOX"], q: "is:unread", max: 100 });
  out.inbox = unreadInbox.length;
  // Starred / important totals (search).
  const [starred, important] = await Promise.all([
    listMessages(token, { q: "is:starred", max: 100 }),
    listMessages(token, { q: "is:important", max: 100 }),
  ]);
  out.starred = starred.length;
  out.important = important.length;
  // Folder totals via label list counts.
  await Promise.all(
    (["sent", "drafts", "spam", "trash"] as const).map(async (f) => {
      const id = FOLDER_LABEL_IDS[f];
      const refs = await listMessages(token, { labelIds: [id], max: 100 });
      out[f] = refs.length;
    }),
  );
  return out;
}

/** Load the full thread for an open email. */
export async function loadThread(
  token: string,
  threadId: string,
  labelIndex: LabelIndex,
): Promise<Email[]> {
  const thread = await getThread(token, threadId);
  return thread.map((m) => mapMessage(m, labelIndex));
}

async function pmap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export type { GmailMessage };