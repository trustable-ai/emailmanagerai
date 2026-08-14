# Mailo — AI Email Manager

An AI-powered email workspace that connects to your real Gmail account.

Mailo is a full email client — folders, threads, composer, search — with an AI
assistant sitting next to it. Anything you can do with the buttons you can also
ask for in plain language, and the two stay in sync: the assistant acts on the
same mailbox you are looking at, and the interface updates as it works.

![Mailo](screenshot.png)

## Sign in

You connect with your own Google account. Sign-in goes through Google's consent
screen and grants Mailo temporary access to read, modify and send your mail; no
password or client secret ever reaches the app. The session is re-validated
against Google on every page load, and you can disconnect at any time from the
top bar or the sidebar. If no Google client is configured, the app says so
honestly instead of falling back to fake data.

## The mail client

**Folders and labels.** Inbox, Starred, Important, Sent, Drafts, Spam, Trash and
Archive, each with live counts, plus your own Gmail labels. The sidebar becomes a
slide-over drawer on small screens, with a bottom navigation bar for the main
folders.

**Email list.** Messages sorted by date, showing sender, subject, snippet, time,
and badges for unread, starred, pinned, high-priority and attachments. Search
filters the current view.

**Thread viewer.** Open a message to read the full conversation with its
recipients, labels, attachments and body. Reply, Reply All, archive, delete,
star, pin, mark read or unread, move to a folder, add or remove labels — every
action goes straight to Gmail. Deleting shows an undo path via Restore.

**Composer.** Write a new message or a reply, with recipients, subject, body and
attachments, and send it from your own address. Drafts can be saved and picked
up later.

**Command palette.** Press ⌘K (Ctrl+K) for a quick launcher: ask the assistant,
jump to a folder, compose, or clear the selection.

## The AI assistant

The assistant panel takes plain language and works on the mailbox you have open.

Ask it to **find** things — unread mail, messages from a person, emails with
attachments, a full-text search, what's important right now.

Ask it to **read for you** — summarize today's inbox, summarize one message,
pull out action items, extract deadlines and due dates.

Ask it to **write** — reply politely or professionally, draft a follow-up,
rewrite a message, change its tone, translate it into another language.

Ask it to **tidy up** — delete spam, archive newsletters and promotions, archive
the whole inbox.

Answers stream in as markdown while they are generated, and a stop button
interrupts a response mid-flight. Navigation and lookup questions are answered
instantly from the mailbox already loaded in the browser; only the writing and
reasoning tasks go to the language model, which receives the real email as
context. Suggested prompts are offered when you don't know what to ask, and
`help` lists everything it understands.

Every action the assistant performs raises a notification in the notification
center, so you always see what changed.

## The experience

Dark and light mode, glassy cards, gradient accents and smooth motion
throughout. Skeleton loaders while the mailbox syncs, clear empty states, and
honest error states when Gmail can't be reached or the Google session has
expired. The layout adapts from a three-pane desktop workspace to a single-pane
mobile client with drawers and sheets.

## How it is put together

The client is a React and TypeScript single-page app (Vite, Tailwind CSS,
Framer Motion, TanStack Query) that talks to the Gmail REST API directly with
your access token. Behind it runs a small serverless backend on Apache
OpenServerless: one action validates the Google session, another streams the
language-model responses from any OpenAI-compatible endpoint.

The backend also carries a self-contained demo mailbox, so the conversational
side of the app can be exercised end to end without connecting a real Google
account.

## Getting started

```bash
npm install
npm run dev
```

Set `VITE_GOOGLE_CLIENT_ID` to a Google OAuth client whose authorized
JavaScript origin includes the app's URL. Copy `.env.dist` to `.env` and set
`AI_BASE_URL`, `AI_API_KEY` and `AI_CHAT_MODEL` to point at your model endpoint.
