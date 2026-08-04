"""Session / userinfo endpoint (v1/me).

This is the backend validation point for the application session. On a
full-page load the frontend sends the persisted opaque token in an
`Authorization: Bearer <token>` header to `/api/my/v1/me`; the response carries
the authoritative identity for the current session. Protected routes only
render once this call succeeds.

Today the mailbox is a demo dataset served by the `v1/chat` action, so the
"session" is a temporary Google OAuth mock and this endpoint returns the
connected demo Google account. To go live, replace `resolve_account` with a
real token validation (Redis-backed session lookup or a Google userinfo
exchange) and keep this same response shape — the frontend does not need to
change.
"""

import json


# Demo Google account connected to the mailbox. In a real deployment this is
# derived from the validated session token, never trusted from the request.
DEMO_ACCOUNT = {
    "name": "Alex Carter",
    "email": "alex.carter@gmail.com",
    "avatar": "AC",
    "provider": "Google",
    "lastSync": "2024-08-04T09:32:00Z",
}


def _bearer(args):
    headers = args.get("__ow_headers") or args.get("headers") or {}
    if not isinstance(headers, dict):
        return ""
    for k, v in headers.items():
        if str(k).lower() == "authorization" and isinstance(v, str):
            return v.strip()
    return ""


def resolve_account(args):
    """Return the authoritative account for the current session.

    A non-empty Bearer token must be present; an absent token means there is no
    session to validate. (In the mock we do not yet inspect the token value;
    the real implementation validates it against the session store.)
    """
    token = _bearer(args).replace("Bearer", "", 1).strip()
    if not token:
        return {"ok": False, "error": "No session token"}
    return {"ok": True, "account": DEMO_ACCOUNT}


def main(args, ctx=None):
    return resolve_account(args)