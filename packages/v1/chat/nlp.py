"""Natural-language intent parsing for the AI email manager.

Turns free-form user text into a structured intent dict:
    {"cmd": "...", "id": "...", "folder": "...", "query": "...", "tone": "...",
     "lang": "...", "raw": "<original text>"}

Matching is intentionally tolerant: keyword + regex based, lowercased.
Unmatched input falls back to "chat" (free conversation with the assistant).
"""

import re

FOLDER_ALIASES = {
    "inbox": "inbox",
    "inbox": "inbox",
    "starred": "starred",
 "star": "starred",
 "important": "starred",
    "sent": "sent",
 "outbox": "sent",
    "drafts": "drafts",
 "draft": "drafts",
    "spam": "spam",
 "junk": "spam",
    "trash": "trash",
 "bin": "trash",
 "deleted": "trash",
    "archive": "archive",
 "all": "archive",
    "archive": "archive",
}

EMAIL_ID_RE = re.compile(r"\b(eml-\d{1,4})\b", re.IGNORECASE)


def _extract_id(text):
    m = EMAIL_ID_RE.search(text)
    if m:
        return m.group(1).lower()
    return ""


def _extract_folder(text):
    t = text.lower()
    for key, folder in FOLDER_ALIASES.items():
        if re.search(r"\b" + re.escape(key) + r"\b", t):
            return folder
    return ""


def parse(text):
    raw = text or ""
    t = raw.lower().strip()
    if not t:
        return {"cmd": "welcome", "raw": raw}

    eid = _extract_id(raw)

    # ---- help ----
    if t in ("help", "?", "commands", "what can you do", "menu"):
        return {"cmd": "help", "raw": raw}

    # ---- sync / account ----
    if re.search(r"\b(refresh|sync|synchroni[sz]e)\b", t) and not re.search(r"\bun(read|star)\b", t):
        return {"cmd": "sync", "raw": raw}
    if re.search(r"\b(account|who am i|my profile|last sync)\b", t):
        return {"cmd": "account", "raw": raw}
    if re.search(r"\b(disconnect|reconnect|sign ?out|log ?out)\b", t):
        return {"cmd": "disconnect", "raw": raw}

    # ---- summarize ----
    if re.search(r"\b(summari[sz]e|summary|sum up|tl;?dr)\b", t):
        if re.search(r"\btoday\b", t) or re.search(r"\b(today'?s|today)\b", t):
            return {"cmd": "summarize_today", "raw": raw}
        if eid:
            return {"cmd": "summarize_email", "id": eid, "raw": raw}
        return {"cmd": "summarize_today", "raw": raw}

    # ---- unread ----
    if re.search(r"\b(unread emails?|show unread|list unread|unread count|how many unread)\b", t):
        return {"cmd": "list_unread", "raw": raw}
    if re.search(r"\bmark .* unread|mark unread|mark as unread\b", t):
        if eid:
            return {"cmd": "mark_unread", "id": eid, "raw": raw}
        return {"cmd": "mark_unread", "raw": raw}
    if re.search(r"\bmark .* read|mark read|mark as read\b", t):
        if eid:
            return {"cmd": "mark_read", "id": eid, "raw": raw}
        return {"cmd": "mark_read", "raw": raw}

    # ---- archive ----
    if re.search(r"\barchive\b", t):
        if re.search(r"\ball\b", t):
            return {"cmd": "archive_all", "raw": raw}
        return {"cmd": "archive", "id": eid, "raw": raw}

    # ---- move / label (before delete so "move X to trash/spam" is precise) ----
    mv = re.search(r"\bmove\b.*\bto\b\s+(\w+)", t)
    if mv:
        folder = FOLDER_ALIASES.get(mv.group(1).lower(), mv.group(1).lower())
        return {"cmd": "move", "id": eid, "folder": folder, "raw": raw}
    lbl = re.search(r"\blabel\b.*\bas\b\s+(\w+)|\badd label\b\s+(\w+)|\btag\b\s+(\w+)", t)
    if lbl:
        label = next((g for g in lbl.groups() if g), "")
        return {"cmd": "label", "id": eid, "query": label, "raw": raw}

    # ---- delete spam ----
    if re.search(r"\b(delete|clear|empty|remove|purge)\b.*\bspam\b", t) or re.search(r"\bspam\b.*\b(delete|clear|empty)\b", t):
        return {"cmd": "delete_spam", "raw": raw}

    # ---- delete ----
    if re.search(r"\b(delete|trash|bin|discard)\b", t) and not re.search(r"\bspam\b", t):
        return {"cmd": "delete", "id": eid, "raw": raw}

    # ---- star / pin ----
    if re.search(r"\bunstar\b|remove star\b", t):
        return {"cmd": "unstar", "id": eid, "raw": raw}
    if re.search(r"\bstar\b|favorite\b|flag\b", t):
        return {"cmd": "star", "id": eid, "raw": raw}
    if re.search(r"\bunpin\b", t):
        return {"cmd": "unpin", "id": eid, "raw": raw}
    if re.search(r"\bpin\b", t):
        return {"cmd": "pin", "id": eid, "raw": raw}

    # ---- reply / follow-up / draft ----
    if re.search(r"\b(draft a|write a)?\s*follow[- ]?up\b", t):
        return {"cmd": "followup", "id": eid, "raw": raw}
    if re.search(r"\b(polite|politely)\b", t) and re.search(r"\b(reply|answer|respond)\b", t):
        return {"cmd": "reply_polite", "id": eid, "raw": raw}
    if re.search(r"\bprofessional\b", t) and re.search(r"\b(reply|answer|respond|write)\b", t):
        return {"cmd": "reply_professional", "id": eid, "raw": raw}
    if re.search(r"\b(reply|respond|answer back)\b", t):
        tone = "professional"
        if re.search(r"\b(friendly|warm|casual|short|concise|polite|formal)\b", t):
            tone_match = re.search(r"\b(friendly|warm|casual|short|concise|polite|formal)\b", t)
            tone = tone_match.group(1)
        return {"cmd": "reply", "id": eid, "tone": tone, "raw": raw}

    # ---- rewrite / tone ----
    if re.search(r"\bchange tone\b|tone to\b|rewrite .*tone|rewrite tone\b", t):
        tone = "professional"
        tm = re.search(r"\b(friendly|warm|casual|short|concise|polite|formal|professional|assertive|apologetic)\b", t)
        if tm:
            tone = tm.group(1)
        return {"cmd": "change_tone", "id": eid, "tone": tone, "raw": raw}
    if re.search(r"\brewrite\b|rephrase\b|reword\b", t):
        return {"cmd": "rewrite", "id": eid, "raw": raw}

    # ---- translate ----
    if re.search(r"\btranslate\b", t):
        lang = "English"
        lm = re.search(r"\bto (english|italian|french|spanish|german|portuguese|japanese|chinese|arabic|hindi)\b", t)
        if lm:
            lang = lm.group(1).capitalize()
        return {"cmd": "translate", "id": eid, "lang": lang, "raw": raw}

    # ---- action items / deadlines ----
    if re.search(r"\baction items?\b|action points?\b|extract action\b", t):
        return {"cmd": "action_items", "id": eid, "raw": raw}
    if re.search(r"\bdeadlines?\b|due dates?\b|what'?s due\b", t):
        return {"cmd": "deadlines", "id": eid, "raw": raw}

    # ---- important / priority ----
    if re.search(r"\b(important emails?|priority emails?|priorities|organize by priority|sort by priority)\b", t):
        return {"cmd": "priority", "raw": raw}

    # ---- attachments ----
    if re.search(r"\b(attachments?|files?|downloads?)\b", t) and re.search(r"\b(show|list|find|with|download)\b", t):
        return {"cmd": "attachments", "raw": raw}

    # ---- find from / search ----
    fm = re.search(r"\b(?:find|show|list|emails?|messages?)\b.*\bfrom\b\s+(.*)$", t)
    if fm:
        return {"cmd": "from_sender", "query": fm.group(1).strip(), "raw": raw}
    sm = re.search(r"\b(?:search|find|look for|query)\b\s+(.*)$", t)
    if sm:
        return {"cmd": "search", "query": sm.group(1).strip(), "raw": raw}

    # ---- show email by id ----
    if eid and re.search(r"\b(show|read|open|view|display)\b", t):
        return {"cmd": "show", "id": eid, "raw": raw}

    # ---- list folders ----
    folder = _extract_folder(t)
    if folder and re.search(r"\b(show|list|open|view|go to|display)\b", t):
        return {"cmd": "list_folder", "folder": folder, "raw": raw}
    if t in FOLDER_ALIASES:
        return {"cmd": "list_folder", "folder": FOLDER_ALIASES[t], "raw": raw}

    # ---- fallback: free chat with the assistant ----
    return {"cmd": "chat", "raw": raw}