"""Session / userinfo endpoint (v1/me).

Validates the user's real Google OAuth access token on every full-page load.
The frontend sends the token in an `Authorization: Bearer <token>` header; this
endpoint calls Google's userinfo endpoint with that token and returns the
authoritative identity. A missing or invalid token yields `ok: false`, so the
frontend clears the session and re-authenticates. No Google client secret is
used or stored here — only the public userinfo endpoint.
"""

import json
import urllib.request
import urllib.error


USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _bearer(args):
    headers = args.get("__ow_headers") or args.get("headers") or {}
    if not isinstance(headers, dict):
        return ""
    for k, v in headers.items():
        if str(k).lower() == "authorization" and isinstance(v, str):
            return v.strip()
    return ""


def _userinfo(token):
    req = urllib.request.Request(
        USERINFO_URL,
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def resolve_account(args):
    token = _bearer(args).replace("Bearer", "", 1).strip()
    if not token:
        return {"ok": False, "error": "No session token"}
    try:
        info = _userinfo(token)
    except urllib.error.HTTPError as exc:
        return {"ok": False, "error": "Google rejected token", "status": exc.code}
    except Exception as exc:
        return {"ok": False, "error": "Session validation failed: %s" % exc}
    email = info.get("email") or ""
    name = info.get("name") or info.get("given_name") or email or "Google User"
    avatar = info.get("picture") or ""
    if not email:
        return {"ok": False, "error": "No email in userinfo"}
    return {
        "ok": True,
        "account": {
            "name": name,
            "email": email,
            "avatar": avatar,
            "provider": "Google",
        },
    }


def main(args, ctx=None):
    return resolve_account(args)