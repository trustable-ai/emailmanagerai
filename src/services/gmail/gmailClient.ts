// Real Gmail API client (browser, OAuth bearer token).
//
// All calls go directly to the Gmail REST API with the user's real Google
// access token. No mock data, no backend proxy. The OAuth client must have
// the app origin registered as an Authorized JavaScript origin in Google Cloud.

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export interface GmailLabel {
  id: string;
  name: string;
  type?: string;
}

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  internalDate: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string; attachmentId?: string; size?: number };
    parts?: GmailPart[];
    mimeType?: string;
    filename?: string;
  };
}

export interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
}

async function gfetch<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    throw new GauthError("Google session expired", 401);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GauthError(`Gmail API ${res.status}: ${text || res.statusText}`, res.status);
  }
  return (await res.json()) as T;
}

export class GauthError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
    this.name = "GauthError";
  }
}

/** List the user's labels (system + user). */
export async function listLabels(token: string): Promise<GmailLabel[]> {
  const data = await gfetch<{ labels: GmailLabel[] }>(
    token,
    `${GMAIL_API}/users/me/labels`,
  );
  return data.labels || [];
}

/** Lightweight message-id list for a folder/label/query. */
export async function listMessages(
  token: string,
  opts: { labelIds?: string[]; q?: string; max?: number } = {},
): Promise<GmailMessageRef[]> {
  const params = new URLSearchParams();
  if (opts.labelIds?.length) opts.labelIds.forEach((l) => params.append("labelIds", l));
  if (opts.q) params.set("q", opts.q);
  params.set("maxResults", String(opts.max ?? 50));
  const data = await gfetch<{ messages?: GmailMessageRef[]; resultSizeEstimate?: number }>(
    token,
    `${GMAIL_API}/users/me/messages?${params.toString()}`,
  );
  return data.messages || [];
}

/** Fetch a single message. Use `metadata` for lists, `full` for the open thread. */
export async function getMessage(
  token: string,
  id: string,
  format: "metadata" | "full" = "metadata",
): Promise<GmailMessage> {
  return gfetch<GmailMessage>(
    token,
    `${GMAIL_API}/users/me/messages/${id}?format=${format}`,
  );
}

/** Fetch all messages in a thread (full). */
export async function getThread(
  token: string,
  threadId: string,
): Promise<GmailMessage[]> {
  const data = await gfetch<{ messages?: GmailMessage[] }>(
    token,
    `${GMAIL_API}/users/me/threads/${threadId}?format=full`,
  );
  return data.messages || [];
}

/** Add/remove labels on a message (archive, read/unread, star, label, move). */
export async function modifyMessage(
  token: string,
  id: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<void> {
  await gfetch(token, `${GMAIL_API}/users/me/messages/${id}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
}

export async function trashMessage(token: string, id: string): Promise<void> {
  await gfetch(token, `${GMAIL_API}/users/me/messages/${id}/trash`, { method: "POST" });
}

export async function untrashMessage(token: string, id: string): Promise<void> {
  await gfetch(token, `${GMAIL_API}/users/me/messages/${id}/untrash`, { method: "POST" });
}

/** Send a message. `raw` is RFC822 base64url-encoded. */
export async function sendMessage(
  token: string,
  raw: string,
): Promise<{ id: string; threadId?: string }> {
  const data = await gfetch<{ id: string; threadId?: string }>(
    token,
    `${GMAIL_API}/users/me/messages/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    },
  );
  return data;
}

/** Profile (email address). */
export async function getProfile(token: string): Promise<{ emailAddress: string }> {
  return gfetch<{ emailAddress: string }>(token, `${GMAIL_API}/users/me/profile`);
}

// --- base64url helpers ------------------------------------------------------

export function b64urlDecodeToStr(b64url: string): string {
  if (!b64url) return "";
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function b64urlEncodeStr(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Google userinfo (used by both the frontend and the v1/me backend). */
export async function fetchGoogleUserinfo(
  token: string,
): Promise<{ name?: string; email?: string; picture?: string; sub?: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new GauthError("Invalid Google session", res.status);
  return res.json();
}