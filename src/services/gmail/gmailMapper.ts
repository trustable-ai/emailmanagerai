// Maps raw Gmail API messages to the app's Email shape.
import type { Email, Folder, Person } from "@/lib/types";
import {
  b64urlDecodeToStr,
  type GmailLabel,
  type GmailMessage,
  type GmailPart,
} from "@/services/gmail/gmailClient";

export interface LabelIndex {
  byId: Record<string, GmailLabel>;
  userLabels: GmailLabel[];
  byName: Record<string, GmailLabel>;
}

/** Build a label id <-> name index from the Gmail label list. */
export function buildLabelIndex(labels: GmailLabel[]): LabelIndex {
  const byId: Record<string, GmailLabel> = {};
  const byName: Record<string, GmailLabel> = {};
  const userLabels: GmailLabel[] = [];
  for (const l of labels) {
    byId[l.id] = l;
    byName[l.name.toLowerCase()] = l;
    if (l.type !== "system") userLabels.push(l);
  }
  return { byId, byName, userLabels };
}

const SYSTEM_LABELS = new Set([
  "INBOX",
  "SENT",
  "DRAFTS",
  "SPAM",
  "TRASH",
  "IMPORTANT",
  "STARRED",
  "UNREAD",
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
]);

function header(payload: GmailMessage["payload"], name: string): string {
  const h = payload?.headers?.find(
    (x) => x.name.toLowerCase() === name.toLowerCase(),
  );
  return h?.value || "";
}

/** Parse RFC5322 address list "Name <a@b>, c@d" into Person[]. */
export function parseAddresses(value: string): Person[] {
  if (!value) return [];
  return value.split(",").map((part) => {
    const p = part.trim();
    const m = p.match(/^(.*?)\s*<([^>]+)>\s*$/);
    if (m) return { name: m[1].replace(/"/g, "").trim() || m[2], email: m[2].trim() };
    return { name: p, email: p };
  });
}

function findTextPart(part: GmailPart): { text: string; html?: string } | null {
  if (!part) return null;
  if (part.mimeType === "text/plain" && part.body?.data) {
    return { text: b64urlDecodeToStr(part.body.data) };
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return { text: "", html: b64urlDecodeToStr(part.body.data) };
  }
  if (part.parts) {
    let text = "";
    let html = "";
    for (const sub of part.parts) {
      const r = findTextPart(sub);
      if (r) {
        if (r.text) text = text || r.text;
        if (r.html) html = html || r.html;
      }
    }
    if (text || html) return { text, html };
  }
  return null;
}

function extractBody(msg: GmailMessage): string {
  const payload = msg.payload;
  if (!payload) return "";
  if (payload.body?.data) return b64urlDecodeToStr(payload.body.data);
  const r = findTextPart(payload as GmailPart);
  if (r) return r.html || r.text || "";
  return "";
}

function collectAttachments(part: GmailPart | undefined, out: Email["attachments"]) {
  if (!part) return;
  if (part.filename && part.body) {
    out.push({
      name: part.filename,
      size: part.body.size || 0,
      type: (part.filename.split(".").pop() || part.mimeType || "file").toLowerCase(),
    });
  }
  if (part.parts) for (const sub of part.parts) collectAttachments(sub, out);
}

export function folderFromLabelIds(labelIds: string[] = []): string {
  const set = new Set(labelIds);
  if (set.has("TRASH")) return "trash";
  if (set.has("SPAM")) return "spam";
  if (set.has("DRAFT")) return "drafts";
  if (set.has("SENT")) return "sent";
  if (set.has("INBOX")) return "inbox";
  return "archive";
}

/** Map a Gmail message to the app Email shape. `full` payload recommended. */
export function mapMessage(
  msg: GmailMessage,
  labelIndex: LabelIndex,
): Email {
  const labelIds = msg.labelIds || [];
  const payload = msg.payload;
  const fromList = parseAddresses(header(payload, "From"));
  const from = fromList[0] || { name: "", email: "" };
  const to = parseAddresses(header(payload, "To"));
  const cc = parseAddresses(header(payload, "Cc"));
  const subject = header(payload, "Subject");
  const dateRaw = header(payload, "Date") || (msg.internalDate ? new Date(Number(msg.internalDate)).toUTCString() : "");
  const body = extractBody(msg);
  const starred = labelIds.includes("STARRED");
  const read = !labelIds.includes("UNREAD");
  const pinned = labelIds.includes("IMPORTANT");
  const isNewsletter = labelIds.some((l) => l.startsWith("CATEGORY_PROMOTIONS") || l.startsWith("CATEGORY_UPDATES"));
  const priority = starred || pinned ? "high" : isNewsletter ? "low" : "normal";

  const labels: string[] = labelIds
    .filter((id) => !SYSTEM_LABELS.has(id) && !id.startsWith("CATEGORY_"))
    .map((id) => labelIndex.byId[id]?.name)
    .filter((n): n is string => !!n);

  const attachments: Email["attachments"] = [];
  collectAttachments(payload as GmailPart, attachments);

  return {
    id: msg.id,
    threadId: msg.threadId,
    folder: folderFromLabelIds(labelIds),
    from,
    to,
    cc,
    subject,
    snippet: msg.snippet || "",
    body,
    date: dateRaw ? new Date(dateRaw).toISOString() : new Date(Number(msg.internalDate) || Date.now()).toISOString(),
    read,
    starred,
    pinned,
    labels,
    attachments,
    priority: priority as Email["priority"],
  };
}

/** Query param per logical folder, mapped to Gmail label ids / search. */
export function folderQuery(folder: Folder): {
  labelIds?: string[];
  q?: string;
} {
  switch (folder) {
    case "inbox":
      return { labelIds: ["INBOX"] };
    case "sent":
      return { labelIds: ["SENT"] };
    case "drafts":
      return { labelIds: ["DRAFT"] };
    case "spam":
      return { labelIds: ["SPAM"] };
    case "trash":
      return { labelIds: ["TRASH"] };
    case "starred":
      return { q: "is:starred" };
    case "important":
      return { q: "is:important" };
    case "archive":
      return { q: "in:anywhere -in:inbox -in:spam -in:trash -in:drafts -in:sent" };
    default:
      return {};
  }
}