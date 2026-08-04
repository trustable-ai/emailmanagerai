// Gmail synchronization service.
//
// In this build the mailbox is served by the app's own data store through the
// `v1/chat` action, so "sync" is a simulated progress sequence that refreshes
// the server snapshot. The interface mirrors what a real Gmail API client
// would expose (folders, labels, threads, attachments) so this file is the
// single place to swap in a real Gmail API integration later without touching
// the UI.

import { fetchMailbox } from "@/services/api/client";
import type { MailboxSnapshot } from "@/lib/types";

export interface SyncStep {
  label: string;
  done: boolean;
}

export const GMAIL_FOLDERS = [
  "inbox",
  "sent",
  "drafts",
  "spam",
  "trash",
] as const;

export const GMAIL_SYNC_STEPS: SyncStep[] = [
  { label: "Connecting to Gmail", done: false },
  { label: "Syncing Inbox", done: false },
  { label: "Syncing Sent", done: false },
  { label: "Syncing Drafts", done: false },
  { label: "Syncing Spam & Trash", done: false },
  { label: "Indexing labels", done: false },
  { label: "Indexing attachments", done: false },
];

/** Run a simulated sync with live progress callbacks, then refresh snapshot. */
export async function syncGmail(
  onStep: (index: number) => void,
  signal?: AbortSignal,
): Promise<MailboxSnapshot> {
  for (let i = 0; i < GMAIL_SYNC_STEPS.length; i++) {
    if (signal?.aborted) throw new Error("Sync aborted");
    await new Promise((r) => setTimeout(r, 220 + Math.random() * 180));
    onStep(i);
  }
  return fetchMailbox();
}