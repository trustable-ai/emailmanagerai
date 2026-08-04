// Frontend AI intent router. With real Gmail, the frontend holds the mailbox
// data, so navigation/data queries are answered locally (no mock backend
// dataset) and only generative tasks (summarize, reply, translate, …) are sent
// to the backend LLM with real email content as context.

import type { Email, Folder } from "@/lib/types";
import { fullName } from "@/lib/mailUtils";

const FOLDER_WORDS: Record<string, Folder> = {
  inbox: "inbox",
  starred: "starred",
  important: "important",
  sent: "sent",
  drafts: "drafts",
  spam: "spam",
  trash: "trash",
  archive: "archive",
};

export type AiPlan =
  | { kind: "generate"; prompt: string; context: string }
  | { kind: "list"; title: string; emails: Email[] }
  | { kind: "text"; text: string }
  | { kind: "bulk"; action: "deleteSpam" | "archiveNewsletters" | "archiveAll" }
  | { kind: "unknown" };

function emailContext(e: Email): string {
  return [
    `Subject: ${e.subject || "(no subject)"}`,
    `From: ${fullName(e.from)} <${e.from.email}>`,
    `Date: ${e.date}`,
    `To: ${e.to.map((t) => t.email).join(", ")}`,
    "",
    e.body || e.snippet || "",
  ].join("\n");
}

const unread = (es: Email[]) => es.filter((e) => !e.read);
const fromSender = (es: Email[], q: string) =>
  es.filter((e) => (e.from.name + " " + e.from.email).toLowerCase().includes(q.toLowerCase()));
const withAttachments = (es: Email[]) => es.filter((e) => e.attachments.length > 0);
const newsletters = (es: Email[]) =>
  es.filter((e) => e.folder === "inbox" && e.labels.some((l) => /newsletter|promo|update/i.test(l)));

export function routeAi(
  input: string,
  selected: Email | undefined,
  emails: Email[],
): AiPlan {
  const t = input.toLowerCase().trim();
  if (!t) return { kind: "unknown" };

  // ---- bulk actions ----
  if (/\b(delete|clear|empty|remove)\b.*\bspam\b/.test(t) || /\bspam\b.*\b(delete|clear|empty)\b/.test(t)) {
    return { kind: "bulk", action: "deleteSpam" };
  }
  if (/\barchive\s+(newsletters?|promo|promotions?)\b/.test(t)) {
    return { kind: "bulk", action: "archiveNewsletters" };
  }
  if (/\barchive\s+all\b/.test(t)) {
    return { kind: "bulk", action: "archiveAll" };
  }

  // ---- data queries ----
  if (/\bunread\b/.test(t) && /\b(show|list|unread emails?|how many)\b/.test(t)) {
    const u = unread(emails.filter((e) => e.folder === "inbox"));
    return { kind: "list", title: "Unread emails", emails: u };
  }
  const fromMatch = t.match(/\b(?:from|emails?\s+from)\s+(.+)$/);
  if (fromMatch && /\b(find|show|list|emails?)\b/.test(t)) {
    return { kind: "list", title: `Emails from ${fromMatch[1]}`, emails: fromSender(emails, fromMatch[1]) };
  }
  if (/\b(search|find|look for|query)\s+(.+)$/.test(t)) {
    const q = (t.match(/\b(?:search|find|look for|query)\s+(.+)$/)![1]).trim();
    const r = emails.filter((e) =>
      [e.subject, e.snippet, e.from.name, e.from.email, ...e.labels].join(" ").toLowerCase().includes(q.toLowerCase()),
    );
    return { kind: "list", title: `Search: “${q}”`, emails: r };
  }
  if (/\battachments?\b/.test(t) && /\b(show|list|with|find)\b/.test(t)) {
    return { kind: "list", title: "Emails with attachments", emails: withAttachments(emails) };
  }
  for (const word of Object.keys(FOLDER_WORDS)) {
    if (new RegExp(`\\b(show|list|open|view|go to)\\b.*\\b${word}\\b`).test(t)) {
      return { kind: "list", title: word.charAt(0).toUpperCase() + word.slice(1), emails: emails.filter((e) => e.folder === word || (word === "starred" && e.starred) || (word === "important" && e.pinned)) };
    }
  }
  if (/^help$|^\?$|what can you do/.test(t)) {
    return { kind: "text", text: HELP_TEXT };
  }

  // ---- generative tasks (LLM with real email context) ----
  const hasEmail = (selected && (t.includes("this email") || t.includes("eml") || /\b(it|this)\b/.test(t))) || false;
  const ctx = selected ? emailContext(selected) : "";

  if (/\bsummar/i.test(t)) {
    if (/\b(today|unread|inbox|digest)\b/.test(t) && !selected) {
      const list = unread(emails.filter((e) => e.folder === "inbox")).slice(0, 12);
      return { kind: "generate", prompt: "Summarize today's unread emails as a concise bulleted digest highlighting senders, key points, urgency, and deadlines.", context: list.map(emailContext).join("\n---\n") };
    }
    if (!selected) return { kind: "text", text: "Open an email first, or ask me to “summarize today's emails”." };
    return { kind: "generate", prompt: "Summarize this email in 3–5 concise bullets and call out any action items or deadlines.", context: ctx };
  }
  if (/\bfollow[- ]?up\b/.test(t)) {
    if (!selected) return { kind: "text", text: "Open an email to draft a follow-up for it." };
    return { kind: "generate", prompt: "Draft a polite follow-up message checking in on the open item and proposing next steps. Return only the follow-up body.", context: ctx };
  }
  if (/\baction items?\b|\baction points?\b/.test(t)) {
    if (!selected) return { kind: "text", text: "Open an email to extract action items from it." };
    return { kind: "generate", prompt: "Extract a clear bulleted list of action items from this email. If there are none, say so.", context: ctx };
  }
  if (/\bdeadlines?\b|\bdue dates?\b/.test(t)) {
    const list = emails.filter((e) => e.folder === "inbox").slice(0, 20);
    return { kind: "generate", prompt: "From these emails, extract every deadline, due date, or time-sensitive item as bullets with the email subject and the date/time.", context: list.map(emailContext).join("\n---\n") };
  }
  if (/\btranslate\b/.test(t)) {
    if (!selected) return { kind: "text", text: "Open an email to translate it." };
    const lang = (t.match(/\bto (english|italian|french|spanish|german|portuguese|japanese|chinese|arabic|hindi)\b/) || [, "English"])[1];
    return { kind: "generate", prompt: `Translate this email body into ${lang}. Return only the translated body.`, context: ctx };
  }
  if (/\bchange tone\b|tone to\b/.test(t)) {
    if (!selected) return { kind: "text", text: "Open an email to change its tone." };
    const tone = (t.match(/\b(friendly|warm|casual|short|concise|polite|formal|professional|assertive|apologetic)\b/) || [, "professional"])[1];
    return { kind: "generate", prompt: `Rewrite this email body in a ${tone} tone. Keep the meaning and return only the new body.`, context: ctx };
  }
  if (/\brewrite\b|rephrase\b|reword\b/.test(t)) {
    if (!selected) return { kind: "text", text: "Open an email to rewrite it." };
    return { kind: "generate", prompt: "Rewrite this email body to be clearer and more polished. Return only the new body.", context: ctx };
  }
  if (/\b(make it|shorter|longer|shorten|lengthen)\b/.test(t)) {
    if (!selected) return { kind: "text", text: "Open an email to shorten or expand it." };
    return { kind: "generate", prompt: "Rewrite this email body to be more concise. Keep the meaning and return only the new body.", context: ctx };
  }
  if (/\b(reply|respond|answer|draft)\b/.test(t)) {
    if (!selected) return { kind: "text", text: "Open an email to reply to it." };
    let tone = "professional";
    if (/\b(friendly|warm|casual|polite|formal|short|concise)\b/.test(t)) tone = (t.match(/\b(friendly|warm|casual|polite|formal|short|concise)\b/)![1]);
    return { kind: "generate", prompt: `Draft a ${tone} reply to this email. Keep it concise, natural, and ready to send.`, context: ctx };
  }

  // ---- free chat: send to the LLM with the current email context ----
  return {
    kind: "generate",
    prompt: input,
    context: selected ? ctx : "",
  };
}

const HELP_TEXT = `**Mailo — AI Email Assistant**

Ask me anything about your Gmail:
- \`summarize today's emails\` / \`summarize this email\`
- \`reply professionally\` / \`reply friendly to this email\`
- \`translate this email to Italian\`
- \`make it shorter\` · \`change tone to friendly\`
- \`extract action items\` · \`extract deadlines\`
- \`show unread\` · \`find emails from John\` · \`search invoices\` · \`show attachments\`
- \`delete spam\` · \`archive newsletters\` · \`archive all\`

Open an email to give me context for write/rewrite tasks.`;

export { HELP_TEXT };