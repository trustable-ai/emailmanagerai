import type {
  MailboxSnapshot,
  ActionResult,
  Email,
  Account,
} from "@/lib/types";

// All app data flows through the single OpenServerless action `v1/chat`.
// The action dispatches by `mode`:
//   - "state"  -> full mailbox snapshot (JSON)
//   - "action" -> a single mutation (JSON)
//   - "chat"   -> conversational AI (markdown text)
// Frontend calls the relative path so the browser keeps its origin.

const CHAT_ENDPOINT = "/api/my/v1/chat";
const ME_ENDPOINT = "/api/my/v1/me";

/** Normalize the wrapped JSON shape that OpenServerless web actions can return. */
function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "body" in raw) {
    const body = (raw as { body: unknown }).body;
    if (typeof body === "string") {
      try {
        return JSON.parse(body) as T;
      } catch {
        return body as unknown as T;
      }
    }
    return body as T;
  }
  return raw as T;
}

export async function fetchMailbox(): Promise<MailboxSnapshot> {
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "state" }),
  });
  if (!res.ok) throw new Error(`Mailbox fetch failed: ${res.status}`);
  const data = unwrap<MailboxSnapshot>(await res.json());
  if (!data || data.ok === false) {
    throw new Error("Mailbox not available");
  }
  return data;
}

/**
 * Validate the persisted opaque session token against the backend `me`
 * endpoint on full-page load. Sends the token in an Authorization header so the
 * backend (not localStorage) is the source of truth for the current identity.
 * Throws on any failure so the caller clears the session and re-authenticates.
 */
export async function fetchMe(token: string): Promise<Account> {
  const res = await fetch(ME_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Session validation failed: ${res.status}`);
  const data = unwrap<{ ok: boolean; account: Account }>(await res.json());
  if (!data || data.ok === false || !data.account) {
    throw new Error("Session invalid");
  }
  return data.account;
}

export interface ActionPayload {
  action: string;
  id?: string;
  folder?: string;
  label?: string;
  to?: string;
  subject?: string;
  body?: string;
}

export async function performAction(
  payload: ActionPayload,
): Promise<ActionResult> {
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "action", ...payload }),
  });
  if (!res.ok) throw new Error(`Action failed: ${res.status}`);
  const data = unwrap<ActionResult>(await res.json());
  if (!data || data.ok === false) {
    throw new Error((data as ActionResult)?.message || "Action failed");
  }
  return data;
}

/** Non-streaming conversational turn (used as a fallback / for quick commands). */
export async function chatOnce(input: string): Promise<string> {
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "chat", input }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  const data = unwrap<{ output?: string; streaming?: boolean }>(
    await res.json(),
  );
  return data.output || "";
}

/**
 * Stream a conversational AI turn from the OpenServerless streaming endpoint.
 * Yields incremental text chunks. The endpoint emits newline-delimited JSON
 * string fragments (each line is a JSON-encoded string token).
 */
export async function* streamChat(
  input: string,
  history: { role: string; content: string }[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch("/stream/web/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, messages: history }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") {
          yield parsed;
        }
      } catch {
        // Not a JSON token line; ignore.
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      const parsed = JSON.parse(tail);
      if (typeof parsed === "string") yield parsed;
    } catch {
      /* ignore */
    }
  }
}

export function mockEmail(): Email | null {
  return null;
}