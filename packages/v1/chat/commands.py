"""Command handlers for the AI email manager.

Each handler takes (args, store, llm) and returns the text output (already
streamed to the socket when an LLM is involved). Pure data commands build
readable text; generative commands delegate to llm helpers.
"""

import nlp
from store import EmailStore


def _fmt_date(d):
    return (d or "").replace("T", " ").replace("Z", " UTC").split(".")[0]


def _sender(e):
    s = e.get("from", {})
    return f"{s.get('name','')} <{s.get('email','')}>"


def _flags(e):
    bits = []
    if not e.get("read"):
        bits.append("unread")
    if e.get("starred"):
        bits.append("starred")
    if e.get("pinned"):
        bits.append("pinned")
    if e.get("priority") == "high":
        bits.append("high-priority")
    return ", ".join(bits)


def _list_header(title, count):
    return f"## {title}\n_{count} email(s)_\n"


def _email_line(e):
    flags = _flags(e)
    subj = e.get("subject", "")
    return (f"- **{e.get('id')}** · {subj} — {_sender(e)} "
            f"[{e.get('date','')[:10]}] {('· ' + flags) if flags else ''}")


def _attachments_lines(e):
    atts = e.get("attachments", [])
    if not atts:
        return "  _(no attachments)_"
    lines = []
    for a in atts:
        size_kb = a.get("size", 0) // 1024
        lines.append(f"  - {a.get('name')} ({a.get('type','?').upper()}, {size_kb} KB)")
    return "\n".join(lines)


def _full_email(e):
    out = []
    out.append(f"### {e.get('subject','(no subject)')}")
    out.append(f"**From:** {_sender(e)}")
    to = ", ".join([f"{p.get('name','')} <{p.get('email','')}>" for p in e.get("to", [])])
    out.append(f"**To:** {to}")
    if e.get("cc"):
        cc = ", ".join([f"{p.get('name','')} <{p.get('email','')}>" for p in e.get("cc", [])])
        out.append(f"**Cc:** {cc}")
    out.append(f"**Date:** {_fmt_date(e.get('date',''))}")
    out.append(f"**Labels:** {', '.join(e.get('labels', [])) or '—'}")
    out.append(f"**Status:** {_flags(e) or 'read'}")
    if e.get("attachments"):
        out.append("**Attachments:**")
        out.append(_attachments_lines(e))
    out.append("")
    out.append(e.get("body", ""))
    return "\n".join(out)


# ---- handlers ----
def help_cmd(args, store, llm, intent):
    lines = [
        "## AI Email Manager — Commands",
        "",
        "**Navigation**",
        "- `show inbox` / `show starred` / `show sent` / `show drafts` / `show spam` / `show trash`",
        "- `show eml-003` — open an email by id",
        "- `account` — active account info",
        "- `sync` — refresh mailbox / show sync status",
        "",
        "**Reading & finding**",
        "- `unread emails` — list unread",
        "- `search invoices` — full-text search",
        "- `find emails from John` — filter by sender",
        "- `show attachments` — emails with attachments",
        "- `summarize today's emails` — AI digest of the inbox",
        "- `summarize eml-003` — summarize one email",
        "- `important emails` / `organize by priority`",
        "- `deadlines` — extract due dates",
        "",
        "**Actions**",
        "- `archive eml-003` / `archive all`",
        "- `delete eml-003` / `delete spam`",
        "- `mark eml-003 unread` / `mark eml-003 read`",
        "- `star eml-003` / `unstar` / `pin` / `unpin`",
        "- `move eml-003 to spam` / `label eml-003 as urgent`",
        "",
        "**AI writing**",
        "- `reply politely to eml-003`",
        "- `write a professional answer to eml-003`",
        "- `draft a follow-up to eml-003`",
        "- `rewrite eml-003`",
        "- `change tone of eml-003 to friendly`",
        "- `translate eml-003 to Italian`",
        "- `action items for eml-003`",
        "",
        "_Just type naturally if you're not sure — I'll do my best to understand._",
    ]
    return "\n".join(lines)


def welcome(args, store, llm, intent):
    c = store.counts()
    acct = store.account
    lines = [
        f"# 👋 Welcome to your AI Email Manager",
        "",
        f"**Account:** {acct.get('name','')} · {acct.get('email','')} ({acct.get('provider','')})",
        f"**Last sync:** {_fmt_date(acct.get('lastSync',''))}",
        "",
        "**Mailbox overview**",
        f"- Inbox: {c.get('inbox',0)} ({len(store.unread('inbox'))} unread)",
        f"- Starred: {c.get('starred',0)}",
        f"- Sent: {c.get('sent',0)}",
        f"- Drafts: {c.get('drafts',0)}",
        f"- Spam: {c.get('spam',0)}",
        f"- Trash: {c.get('trash',0)}",
        "",
        "Try: `summarize today's emails`, `unread emails`, `search invoices`, "
        "`find emails from John`, `show attachments`, or type `help`.",
    ]
    return "\n".join(lines)


def account(args, store, llm, intent):
    acct = store.account
    return "\n".join([
        "## Account",
        f"- **Name:** {acct.get('name','')}",
        f"- **Email:** {acct.get('email','')}",
        f"- **Provider:** {acct.get('provider','')}",
        f"- **Last sync:** {_fmt_date(acct.get('lastSync',''))}",
        f"- **Labels:** {', '.join(store.labels)}",
        "Type `sync` to refresh, or `disconnect` to sign out.",
    ])


def sync(args, store, llm, intent):
    acct = store.account
    c = store.counts()
    lines = [
        "🔄 **Synchronizing mailbox...**",
        "",
        "✓ Inbox synced",
        "✓ Sent synced",
        "✓ Drafts synced",
        "✓ Trash synced",
        "✓ Labels synced",
        "✓ Attachments indexed",
        "",
        f"**Last synchronization:** {_fmt_date(acct.get('lastSync',''))}",
        f"**Unread:** {c.get('unread',0)} · **Spam:** {c.get('spam',0)}",
        "",
        "Mailbox is up to date.",
    ]
    return "\n".join(lines)


def disconnect(args, store, llm, intent):
    return ("🔒 Disconnecting Google account...\n\n"
            "Your session has ended. Reconnect anytime with `reconnect` "
            "to resume managing your mailbox.")


def list_folder(args, store, llm, intent):
    folder = intent.get("folder", "inbox")
    emails = store.sorted(store.by_folder(folder))
    title = folder.capitalize()
    if not emails:
        return f"## {title}\n_No emails in {folder}._"
    lines = [_list_header(title, len(emails))]
    for e in emails:
        lines.append(_email_line(e))
    return "\n".join(lines)


def list_unread(args, store, llm, intent):
    emails = store.sorted(store.unread())
    if not emails:
        return "✅ You're all caught up — no unread emails."
    lines = [_list_header("Unread emails", len(emails))]
    for e in emails:
        lines.append(_email_line(e))
    return "\n".join(lines)


def show(args, store, llm, intent):
    e = store.get(intent.get("id", ""))
    if not e:
        return "⚠️ Email not found. Use an id like `show eml-003`."
    return _full_email(e)


def archive(args, store, llm, intent):
    eid = intent.get("id", "")
    if not eid:
        # default to most recent inbox email
        recent = store.sorted(store.by_folder("inbox"))
        if not recent:
            return "Inbox is empty — nothing to archive."
        eid = recent[0].get("id")
    if store.move(eid, "archive"):
        store.persist()
        e = store.get(eid)
        return f"📦 Archived `{eid}` — “{e.get('subject','')}”."
    return f"⚠️ Could not archive — email `{eid}` not found."


def archive_all(args, store, llm, intent):
    inbox = store.by_folder("inbox")
    n = 0
    for e in inbox:
        e["folder"] = "archive"
        n += 1
    store.persist()
    return f"📦 Archived {n} inbox email(s)."


def delete_spam(args, store, llm, intent):
    n = store.empty_spam()
    store.persist()
    if n:
        return f"🗑️ Moved {n} spam email(s) to Trash."
    return "Spam folder is already empty."


def delete_email(args, store, llm, intent):
    eid = intent.get("id", "")
    if not eid:
        return "⚠️ Specify an email id, e.g. `delete eml-006`."
    if store.delete(eid):
        store.persist()
        return f"🗑️ Moved `{eid}` to Trash."
    return f"⚠️ Could not delete — email `{eid}` not found."


def mark_unread(args, store, llm, intent):
    eid = intent.get("id", "")
    if not eid:
        return "⚠️ Specify an email id, e.g. `mark eml-003 unread`."
    if store.set_read(eid, False):
        store.persist()
        return f"✉️ Marked `{eid}` as unread."
    return f"⚠️ Email `{eid}` not found."


def mark_read(args, store, llm, intent):
    eid = intent.get("id", "")
    if not eid:
        return "⚠️ Specify an email id, e.g. `mark eml-003 read`."
    if store.set_read(eid, True):
        store.persist()
        return f"✓ Marked `{eid}` as read."
    return f"⚠️ Email `{eid}` not found."


def star(args, store, llm, intent):
    eid = intent.get("id", "")
    if not eid:
        return "⚠️ Specify an email id, e.g. `star eml-003`."
    if store.set_star(eid, True):
        store.persist()
        return f"⭐ Starred `{eid}`."
    return f"⚠️ Email `{eid}` not found."


def unstar(args, store, llm, intent):
    eid = intent.get("id", "")
    if not eid:
        return "⚠️ Specify an email id, e.g. `unstar eml-003`."
    if store.set_star(eid, False):
        store.persist()
        return f"☆ Unstarred `{eid}`."
    return f"⚠️ Email `{eid}` not found."


def pin(args, store, llm, intent):
    eid = intent.get("id", "")
    if not eid:
        return "⚠️ Specify an email id, e.g. `pin eml-003`."
    if store.set_pin(eid, True):
        store.persist()
        return f"📌 Pinned `{eid}`."
    return f"⚠️ Email `{eid}` not found."


def unpin(args, store, llm, intent):
    eid = intent.get("id", "")
    if not eid:
        return "⚠️ Specify an email id, e.g. `unpin eml-003`."
    if store.set_pin(eid, False):
        store.persist()
        return f"📍 Unpinned `{eid}`."
    return f"⚠️ Email `{eid}` not found."


def move(args, store, llm, intent):
    eid = intent.get("id", "")
    folder = intent.get("folder", "")
    if not eid or not folder:
        return "⚠️ Usage: `move eml-003 to spam`."
    if store.move(eid, folder):
        store.persist()
        return f"📁 Moved `{eid}` to {folder}."
    return f"⚠️ Could not move — email `{eid}` not found."


def label(args, store, llm, intent):
    eid = intent.get("id", "")
    lbl = intent.get("query", "")
    if not eid or not lbl:
        return "⚠️ Usage: `label eml-003 as urgent`."
    if store.add_label(eid, lbl):
        store.persist()
        return f"🏷️ Added label “{lbl}” to `{eid}`."
    return f"⚠️ Could not label — email `{eid}` not found."


def search(args, store, llm, intent):
    q = intent.get("query", "")
    if not q:
        return "⚠️ What should I search for? e.g. `search invoices`."
    emails = store.search(q)
    if not emails:
        return f"No emails matched “{q}”."
    lines = [_list_header(f"Search: “{q}”", len(emails))]
    for e in emails:
        lines.append(_email_line(e))
    return "\n".join(lines)


def from_sender(args, store, llm, intent):
    q = intent.get("query", "")
    if not q:
        return "⚠️ Whose emails? e.g. `find emails from John`."
    emails = store.from_sender(q)
    if not emails:
        return f"No emails from “{q}”."
    lines = [_list_header(f"From: {q}", len(emails))]
    for e in emails:
        lines.append(_email_line(e))
    return "\n".join(lines)


def attachments(args, store, llm, intent):
    emails = store.sorted(store.with_attachments())
    if not emails:
        return "No emails with attachments."
    lines = [_list_header("Emails with attachments", len(emails))]
    for e in emails:
        lines.append(_email_line(e))
        lines.append(_attachments_lines(e))
    return "\n".join(lines)


def priority(args, store, llm, intent):
    emails = store.important()
    if not emails:
        return "No priority emails right now."
    lines = ["## Priority & important emails", ""]
    for prio in ("high", "normal", "low"):
        group = [e for e in emails if e.get("priority", "normal") == prio]
        if group:
            lines.append(f"\n**{prio.upper()}**")
            for e in group:
                lines.append(_email_line(e))
    return "\n".join(lines)


# ---- generative handlers (delegate to LLM) ----
def _resolve_email(store, intent, prefer_inbox=True):
    eid = intent.get("id", "")
    if eid:
        return store.get(eid)
    if prefer_inbox:
        recent = store.sorted(store.by_folder("inbox"))
        if recent:
            return recent[0]
    return None


def summarize_today(args, store, llm, intent):
    emails = store.today()
    if not emails:
        return "Inbox is empty — nothing to summarize."
    header = f"## 📰 Today's email digest\n_{len(emails)} email(s)_\n\n"
    return header + llm.summarize(args, emails)


def summarize_email(args, store, llm, intent):
    e = _resolve_email(store, intent)
    if not e:
        return "⚠️ Specify an email id, e.g. `summarize eml-003`."
    header = f"## Summary of `{e.get('id')}` — {e.get('subject','')}\n\n"
    return header + llm.summarize_email(args, e)


def reply_polite(args, store, llm, intent):
    e = _resolve_email(store, intent)
    if not e:
        return "⚠️ Specify an email id, e.g. `reply politely to eml-003`."
    header = f"## 📝 Polite reply to `{e.get('id')}` — {e.get('subject','')}\n\n"
    return header + llm.draft_reply(args, e, tone="polite and friendly")


def reply_professional(args, store, llm, intent):
    e = _resolve_email(store, intent)
    if not e:
        return "⚠️ Specify an email id, e.g. `write a professional answer to eml-003`."
    header = f"## 📝 Professional reply to `{e.get('id')}` — {e.get('subject','')}\n\n"
    return header + llm.draft_reply(args, e, tone="professional")


def reply_cmd(args, store, llm, intent):
    e = _resolve_email(store, intent)
    if not e:
        return "⚠️ Specify an email id, e.g. `reply to eml-003`."
    tone = intent.get("tone", "professional")
    header = f"## 📝 Reply ({tone}) to `{e.get('id')}` — {e.get('subject','')}\n\n"
    return header + llm.draft_reply(args, e, tone=tone)


def followup(args, store, llm, intent):
    e = _resolve_email(store, intent)
    if not e:
        return "⚠️ Specify an email id, e.g. `draft a follow-up to eml-003`."
    header = f"## 🔄 Follow-up to `{e.get('id')}` — {e.get('subject','')}\n\n"
    return header + llm.followup(args, e)


def rewrite(args, store, llm, intent):
    e = _resolve_email(store, intent)
    if not e:
        return "⚠️ Specify an email id, e.g. `rewrite eml-011`."
    header = f"## ✏️ Rewritten email `{e.get('id')}` — {e.get('subject','')}\n\n"
    return header + llm.rewrite(args, e)


def change_tone(args, store, llm, intent):
    e = _resolve_email(store, intent)
    if not e:
        return "⚠️ Specify an email id, e.g. `change tone of eml-011 to friendly`."
    tone = intent.get("tone", "professional")
    header = f"## 🎚️ `{e.get('id')}` in a {tone} tone\n\n"
    return header + llm.change_tone(args, e, tone=tone)


def translate(args, store, llm, intent):
    e = _resolve_email(store, intent)
    if not e:
        return "⚠️ Specify an email id, e.g. `translate eml-003 to Italian`."
    lang = intent.get("lang", "English")
    header = f"## 🌐 `{e.get('id')}` translated to {lang}\n\n"
    return header + llm.translate(args, e, lang=lang)


def action_items(args, store, llm, intent):
    e = _resolve_email(store, intent)
    if not e:
        return "⚠️ Specify an email id, e.g. `action items for eml-003`."
    header = f"## ✅ Action items — `{e.get('id')}`\n\n"
    return header + llm.action_items(args, e)


def deadlines(args, store, llm, intent):
    emails = store.sorted(store.by_folder("inbox"))
    header = "## 📅 Deadlines & due dates\n\n"
    return header + llm.deadlines(args, emails)


def free_chat(args, store, llm, intent):
    # Default: hand the message to the LLM with the email-manager system prompt.
    return llm.ask(args, intent.get("raw", ""))


# ---- dispatch table ----
HANDLERS = {
    "help": help_cmd,
    "welcome": welcome,
    "account": account,
    "sync": sync,
    "disconnect": disconnect,
    "list_folder": list_folder,
    "list_unread": list_unread,
    "show": show,
    "archive": archive,
    "archive_all": archive_all,
    "delete_spam": delete_spam,
    "delete": delete_email,
    "mark_unread": mark_unread,
    "mark_read": mark_read,
    "star": star,
    "unstar": unstar,
    "pin": pin,
    "unpin": unpin,
    "move": move,
    "label": label,
    "search": search,
    "from_sender": from_sender,
    "attachments": attachments,
    "priority": priority,
    "summarize_today": summarize_today,
    "summarize_email": summarize_email,
    "reply_polite": reply_polite,
    "reply_professional": reply_professional,
    "reply": reply_cmd,
    "followup": followup,
    "rewrite": rewrite,
    "change_tone": change_tone,
    "translate": translate,
    "action_items": action_items,
    "deadlines": deadlines,
    "chat": free_chat,
}


def run(args, store, llm, intent):
    cmd = intent.get("cmd", "chat")
    handler = HANDLERS.get(cmd, free_chat)
    return handler(args, store, llm, intent)