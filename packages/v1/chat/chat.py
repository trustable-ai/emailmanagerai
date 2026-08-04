"""AI Email Manager — chat backend entrypoint.

This module is the single public entrypoint for the email manager. It supports
three request modes, selected by the ``mode`` field in the request args:

* ``mode: "state"``  — return the full mailbox snapshot as JSON
  ``{ok, account, labels, emails, counts}``. Used by the graphical UI to load
  and refresh the mailbox.
* ``mode: "action"`` — perform a single mailbox mutation and return
  ``{ok, message, email, counts}``. Used by the graphical UI controls so the
  interface and the AI conversation stay synchronized.
* ``mode: "chat"`` (or absent) — the original conversational flow. Routes
  natural-language input through the intent parser, runs the matching command
  against the in-memory store, and returns ``{output, streaming}``. Generative
  tasks stream from the LLM.

Public contract (backward compatible with the starter chat):
    chat(args) -> {"output": <str>, "streaming": True}

Args:
    input    : user message (string)
    messages : optional conversational context (list)
    mode     : "state" | "action" | "chat" (optional, defaults to "chat")
    AI_*     : LLM connection params (injected by the wrapper)
"""

import json
import traceback
from datetime import datetime, timezone

import nlp
import commands
from store import load_store, EmailStore
import llm as llm_mod


# ---------------------------------------------------------------------------
# Structured API (graphical UI) ----------------------------------------------
# ---------------------------------------------------------------------------

# Folders that the UI can move mail into / filter by.
UI_FOLDERS = ("inbox", "starred", "sent", "drafts", "spam", "trash", "archive")


def _snapshot(store):
    """Build the JSON-serialisable mailbox snapshot."""
    return {
        "ok": True,
        "account": store.account,
        "labels": store.labels,
        "emails": store.emails,
        "counts": store.counts(),
    }


def _ok(store, message="", email=None):
    return {
        "ok": True,
        "message": message,
        "email": email,
        "counts": store.counts(),
    }


def _fail(message):
    return {"ok": False, "message": message, "counts": {}}


def _need_id(store, eid):
    e = store.get(eid)
    if not e:
        return None, _fail("Email %s not found" % eid)
    return e, None


def api_state(args):
    store = EmailStore(load_store())
    return _snapshot(store)


def api_action(args):
    """Dispatch a single graphical UI action against the store."""
    store = EmailStore(load_store())
    action = (args.get("action") or "").strip().lower()
    eid = (args.get("id") or args.get("email_id") or "").strip()

    def persist_and(store):
        try:
            store.persist()
        except Exception as exc:
            print("persist skipped:", exc)

    if action in ("", "state", "refresh"):
        return _snapshot(store)

    if action == "sync":
        acct = store.account
        acct["lastSync"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        store.data["account"] = acct
        persist_and(store)
        return _ok(store, "Mailbox synchronized.")

    if action == "restore":
        e, err = _need_id(store, eid)
        if err:
            return err
        e["folder"] = "inbox"
        persist_and(store)
        return _ok(store, "Restored %s to Inbox." % eid, e)

    if action == "archive":
        if not eid:
            return _fail("Specify an email id.")
        e, err = _need_id(store, eid)
        if err:
            return err
        e["folder"] = "archive"
        persist_and(store)
        return _ok(store, "Archived %s." % eid, e)

    if action == "archive_all":
        n = 0
        for e in store.by_folder("inbox"):
            e["folder"] = "archive"
            n += 1
        persist_and(store)
        return _ok(store, "Archived %d inbox email(s)." % n)

    if action == "delete":
        if not eid:
            return _fail("Specify an email id.")
        e, err = _need_id(store, eid)
        if err:
            return err
        if e.get("folder") == "trash":
            store.delete(eid)
        else:
            e["folder"] = "trash"
        persist_and(store)
        return _ok(store, "Moved %s to Trash." % eid, e)

    if action == "delete_forever":
        if not eid:
            return _fail("Specify an email id.")
        if not store.delete(eid):
            return _fail("Email %s not found." % eid)
        persist_and(store)
        return _ok(store, "Deleted %s forever." % eid)

    if action == "empty_trash":
        n = 0
        for e in list(store.emails):
            if e.get("folder") == "trash":
                store.emails.remove(e)
                n += 1
        persist_and(store)
        return _ok(store, "Emptied trash (%d email(s))." % n)

    if action == "delete_spam":
        n = store.empty_spam()
        persist_and(store)
        return _ok(store, "Moved %d spam email(s) to Trash." % n)

    if action == "mark_read":
        e, err = _need_id(store, eid)
        if err:
            return err
        store.set_read(eid, True)
        persist_and(store)
        return _ok(store, "Marked %s as read." % eid, e)

    if action == "mark_unread":
        e, err = _need_id(store, eid)
        if err:
            return err
        store.set_read(eid, False)
        persist_and(store)
        return _ok(store, "Marked %s as unread." % eid, e)

    if action == "star":
        e, err = _need_id(store, eid)
        if err:
            return err
        store.set_star(eid, True)
        persist_and(store)
        return _ok(store, "Starred %s." % eid, e)

    if action == "unstar":
        e, err = _need_id(store, eid)
        if err:
            return err
        store.set_star(eid, False)
        persist_and(store)
        return _ok(store, "Unstarred %s." % eid, e)

    if action == "pin":
        e, err = _need_id(store, eid)
        if err:
            return err
        store.set_pin(eid, True)
        persist_and(store)
        return _ok(store, "Pinned %s." % eid, e)

    if action == "unpin":
        e, err = _need_id(store, eid)
        if err:
            return err
        store.set_pin(eid, False)
        persist_and(store)
        return _ok(store, "Unpinned %s." % eid, e)

    if action == "move":
        folder = (args.get("folder") or "").strip().lower()
        if not folder:
            return _fail("Specify a target folder.")
        e, err = _need_id(store, eid)
        if err:
            return err
        e["folder"] = folder
        persist_and(store)
        return _ok(store, "Moved %s to %s." % (eid, folder), e)

    if action == "label":
        label = (args.get("label") or "").strip().lower()
        if not label:
            return _fail("Specify a label.")
        e, err = _need_id(store, eid)
        if err:
            return err
        store.add_label(eid, label)
        persist_and(store)
        return _ok(store, "Added label '%s' to %s." % (label, eid), e)

    if action == "unlabel":
        label = (args.get("label") or "").strip().lower()
        if not label:
            return _fail("Specify a label.")
        e, err = _need_id(store, eid)
        if err:
            return err
        store.remove_label(eid, label)
        persist_and(store)
        return _ok(store, "Removed label '%s' from %s." % (label, eid), e)

    if action == "send":
        to_raw = args.get("to") or ""
        subject = args.get("subject") or "(no subject)"
        body = args.get("body") or ""
        acct = store.account
        to_list = []
        if isinstance(to_raw, list):
            to_list = to_raw
        elif isinstance(to_raw, str) and to_raw.strip():
            for part in to_raw.split(","):
                part = part.strip()
                if part:
                    if "<" in part and part.endswith(">"):
                        name, email = part.rsplit("<", 1)
                        to_list.append({"name": name.strip(), "email": email[:-1].strip()})
                    else:
                        to_list.append({"name": part, "email": part})
        new_id = "eml-%03d" % (len(store.emails) + 1)
        thread_id = "thr-%03d" % (len(store.emails) + 1)
        email = {
            "id": new_id,
            "threadId": thread_id,
            "folder": "sent",
            "from": {"name": acct.get("name", ""), "email": acct.get("email", "")},
            "to": to_list,
            "cc": [],
            "subject": subject,
            "snippet": (body or "")[:160],
            "body": body,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "read": True,
            "starred": False,
            "pinned": False,
            "labels": [],
            "attachments": [],
            "priority": "normal",
        }
        store.emails.append(email)
        persist_and(store)
        return _ok(store, "Message sent to %s." % (", ".join(p.get("email", "") for p in to_list) or "—"), email)

    if action == "save_draft":
        subject = args.get("subject") or "(no subject)"
        body = args.get("body") or ""
        acct = store.account
        new_id = "eml-%03d" % (len(store.emails) + 1)
        email = {
            "id": new_id,
            "threadId": "thr-%03d" % (len(store.emails) + 1),
            "folder": "drafts",
            "from": {"name": acct.get("name", ""), "email": acct.get("email", "")},
            "to": [],
            "cc": [],
            "subject": subject,
            "snippet": body[:160],
            "body": body,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "read": True,
            "starred": False,
            "pinned": False,
            "labels": [],
            "attachments": [],
            "priority": "normal",
        }
        store.emails.append(email)
        persist_and(store)
        return _ok(store, "Draft saved.", email)

    return _fail("Unknown action: %s" % action)


# ---------------------------------------------------------------------------
# Conversational flow (original chat contract) ------------------------------
# ---------------------------------------------------------------------------

def chat_flow(args):
    inp = args.get("input", "") or ""

    try:
        data = load_store()
        store = EmailStore(data)

        # Build the LLM only when a generative path is actually needed; for
        # pure data commands we skip the LLM to keep latency and cost low.
        ai = llm_mod.LLM(args)

        intent = nlp.parse(inp)
        print("intent:", intent)

        out = commands.run(args, store, ai, intent)

        try:
            store.persist()
        except Exception as exc:
            print("persist skipped:", exc)

    except Exception as e:
        traceback.print_exc()
        out = "Error: %s\n" % str(e)

    return {"output": out, "streaming": True}


def chat(args):
    """Public entrypoint. Dispatches by request ``mode``."""
    if not isinstance(args, dict):
        args = {}
    mode = (args.get("mode") or "chat").strip().lower()

    if mode == "state":
        return api_state(args)
    if mode == "action":
        return api_action(args)
    return chat_flow(args)