// Shared domain types for the AI Email Client.

export interface Person {
  name: string;
  email: string;
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
}

export type Folder =
  | "inbox"
  | "starred"
  | "important"
  | "sent"
  | "drafts"
  | "spam"
  | "trash"
  | "archive";

export type Priority = "high" | "normal" | "low";

export interface Email {
  id: string;
  threadId: string;
  folder: string;
  from: Person;
  to: Person[];
  cc: Person[];
  subject: string;
  snippet: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  pinned: boolean;
  labels: string[];
  attachments: Attachment[];
  priority: Priority;
}

export interface Account {
  name: string;
  email: string;
  avatar: string;
  provider: string;
  lastSync: string;
}

export interface MailboxSnapshot {
  ok: boolean;
  account: Account;
  labels: string[];
  emails: Email[];
  counts: Record<string, number>;
}

export interface ActionResult {
  ok: boolean;
  message: string;
  email?: Email;
  counts?: Record<string, number>;
}

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
  kind?: "ai" | "action" | "system";
  pending?: boolean;
}

export interface AppNotification {
  id: number;
  title: string;
  description?: string;
  variant: "default" | "success" | "error" | "info";
  ts: number;
}