"""In-memory email store loaded from emails.json.

The store is the single source of truth for the AI email manager backend.
It loads the dataset once per activation, applies mutations in-memory, and
best-effort persists them back to emails.json so changes survive across turns
when the filesystem is writable.
"""

import json
import os
import copy
from datetime import datetime, timezone

DATA_FILE = "emails.json"

FOLDERS = ("inbox", "starred", "sent", "drafts", "spam", "trash", "archive")


def _data_path():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, DATA_FILE)


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def load_store():
    """Load the raw JSON document and return the full dict (account, labels, emails)."""
    path = _data_path()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if "emails" not in data:
        data["emails"] = []
    return data


def save_store(data):
    """Best-effort persist the full store back to disk."""
    try:
        path = _data_path()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as exc:
        print("save_store failed:", exc)
        return False


class EmailStore:
    def __init__(self, data):
        self.data = data
        self.account = data.get("account", {})
        self.labels = data.get("labels", [])
        self.emails = data.get("emails", [])

    # ---- persistence ----
    def persist(self):
        self.data["emails"] = self.emails
        save_store(self.data)

    # ---- helpers ----
    def get(self, email_id):
        for e in self.emails:
            if e.get("id") == email_id:
                return e
        return None

    def thread(self, thread_id):
        return [e for e in self.emails if e.get("threadId") == thread_id]

    def by_folder(self, folder):
        if folder == "starred":
            return [e for e in self.emails if e.get("starred")]
        return [e for e in self.emails if e.get("folder") == folder]

    def sorted(self, emails):
        return sorted(
            emails,
            key=lambda e: _parse_date(e.get("date")) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

    # ---- queries ----
    def unread(self, folder=None):
        base = self.emails if folder is None else self.by_folder(folder)
        return [e for e in base if not e.get("read")]

    def with_attachments(self, folder=None):
        base = self.emails if folder is None else self.by_folder(folder)
        return [e for e in base if e.get("attachments")]

    def from_sender(self, name):
        name_l = name.lower().strip()
        if not name_l:
            return []
        results = []
        for e in self.emails:
            sender = e.get("from", {})
            full = (sender.get("name", "") + " " + sender.get("email", "")).lower()
            if name_l in full:
                results.append(e)
        return results

    def search(self, query):
        q = query.lower().strip()
        if not q:
            return []
        results = []
        for e in self.emails:
            haystack = " ".join([
                e.get("subject", ""),
                e.get("snippet", ""),
                e.get("body", ""),
                e.get("from", {}).get("name", ""),
                e.get("from", {}).get("email", ""),
                " ".join(e.get("labels", [])),
            ]).lower()
            if q in haystack:
                results.append(e)
        return self.sorted(results)

    def today(self):
        # Treat all inbox emails as "today's" for the demo dataset; in a real
        # integration this filters by the current calendar day.
        return self.sorted(self.by_folder("inbox"))

    def important(self):
        results = [e for e in self.emails
                   if e.get("priority") == "high" or e.get("starred") or e.get("pinned")]
        return self.sorted(results)

    # ---- mutations ----
    def move(self, email_id, folder):
        e = self.get(email_id)
        if not e:
            return False
        e["folder"] = folder
        return True

    def set_read(self, email_id, value):
        e = self.get(email_id)
        if not e:
            return False
        e["read"] = bool(value)
        return True

    def set_star(self, email_id, value):
        e = self.get(email_id)
        if not e:
            return False
        e["starred"] = bool(value)
        return True

    def set_pin(self, email_id, value):
        e = self.get(email_id)
        if not e:
            return False
        e["pinned"] = bool(value)
        return True

    def add_label(self, email_id, label):
        e = self.get(email_id)
        if not e:
            return False
        labels = e.setdefault("labels", [])
        if label not in labels:
            labels.append(label)
        if label not in self.labels:
            self.labels.append(label)
        return True

    def remove_label(self, email_id, label):
        e = self.get(email_id)
        if not e:
            return False
        labels = e.get("labels", [])
        if label in labels:
            labels.remove(label)
        return True

    def delete(self, email_id):
        for i, e in enumerate(self.emails):
            if e.get("id") == email_id:
                if e.get("folder") == "trash":
                    self.emails.pop(i)
                else:
                    e["folder"] = "trash"
                return True
        return False

    def empty_spam(self):
        moved = 0
        for e in self.emails:
            if e.get("folder") == "spam":
                e["folder"] = "trash"
                moved += 1
        return moved

    def counts(self):
        out = {}
        for f in FOLDERS:
            if f == "starred":
                out[f] = len([e for e in self.emails if e.get("starred")])
            else:
                out[f] = len([e for e in self.emails if e.get("folder") == f])
        out["unread"] = len(self.unread())
        return out