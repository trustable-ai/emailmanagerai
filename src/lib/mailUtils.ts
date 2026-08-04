import type { Email, Folder, Person } from "@/lib/types";

/** Deterministic avatar initials from a name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic gradient color from a string (for avatars/labels). */
const PALETTE = [
  "from-rose-500 to-pink-500",
  "from-blue-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-violet-500 to-purple-500",
  "from-cyan-500 to-sky-500",
  "from-fuchsia-500 to-pink-500",
  "from-lime-500 to-green-500",
];

export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function fullName(p?: Person | null): string {
  if (!p) return "";
  return p.name || p.email;
}

/** Relative time, falling back to a short absolute date. */
export function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const days = diff / 86400;
  if (days < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Filter the raw email list for a logical folder. */
export function emailsForFolder(emails: Email[], folder: Folder): Email[] {
  switch (folder) {
    case "inbox":
      return emails.filter((e) => e.folder === "inbox");
    case "starred":
      return emails.filter((e) => e.starred);
    case "important":
      return emails.filter(
        (e) => e.priority === "high" || e.starred || e.pinned,
      );
    case "sent":
      return emails.filter((e) => e.folder === "sent");
    case "drafts":
      return emails.filter((e) => e.folder === "drafts");
    case "spam":
      return emails.filter((e) => e.folder === "spam");
    case "trash":
      return emails.filter((e) => e.folder === "trash");
    case "archive":
      return emails.filter((e) => e.folder === "archive");
    default:
      return emails;
  }
}

/** Unread count for a folder, for sidebar badges. */
export function unreadForFolder(emails: Email[], folder: Folder): number {
  return emailsForFolder(emails, folder).filter((e) => !e.read).length;
}

export function sortByDate(emails: Email[]): Email[] {
  return [...emails].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/** Apply a search query across subject/snippet/body/sender/labels. */
export function searchEmails(emails: Email[], q: string): Email[] {
  const query = q.trim().toLowerCase();
  if (!query) return emails;
  return emails.filter((e) => {
    const hay = [
      e.subject,
      e.snippet,
      e.body,
      e.from?.name,
      e.from?.email,
      ...e.labels,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  });
}

/** Group emails by threadId for the thread viewer. */
export function threadEmails(emails: Email[], threadId: string): Email[] {
  return sortByDate(emails.filter((e) => e.threadId === threadId));
}

export const FOLDER_LABELS: Record<Folder, string> = {
  inbox: "Inbox",
  starred: "Starred",
  important: "Important",
  sent: "Sent",
  drafts: "Drafts",
  spam: "Spam",
  trash: "Trash",
  archive: "Archive",
};

export const LABEL_COLORS: Record<string, string> = {
  work: "bg-blue-500/15 text-blue-600 dark:text-blue-300 ring-blue-500/30",
  personal: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30",
  invoices: "bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-amber-500/30",
  travel: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 ring-cyan-500/30",
  urgent: "bg-rose-500/15 text-rose-600 dark:text-rose-300 ring-rose-500/30",
  finance: "bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-violet-500/30",
  newsletter: "bg-slate-500/15 text-slate-600 dark:text-slate-300 ring-slate-500/30",
  family: "bg-pink-500/15 text-pink-600 dark:text-pink-300 ring-pink-500/30",
};

export function labelClass(label: string): string {
  return (
    LABEL_COLORS[label] ||
    "bg-primary/15 text-primary ring-primary/30"
  );
}