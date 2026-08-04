// Authentication context — REAL Google OAuth via Google Identity Services.
//
// Uses the GIS token client (Authorization Code / token flow, no client secret
// ever touches the browser). The user grants temporary access to Gmail + their
// profile; we receive a short-lived Google access token. The token is sent to
// the backend `v1/me` endpoint on every full-page load, and `v1/me` validates it
// against Google's userinfo endpoint, so the backend (not localStorage) is the
// source of truth for the current identity.
//
// The Google OAuth client id MUST be provided by the user through the
// immutable app environment as `VITE_GOOGLE_CLIENT_ID`. If it is absent the app
// shows an honest "Google OAuth not configured" state instead of a mock.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { session, type SessionProfile } from "@/services/session/session";
import { fetchGoogleUserinfo } from "@/services/gmail/gmailClient";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (resp: {
              access_token?: string;
              expires_in?: number;
              error?: string;
              error_description?: string;
            }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export interface AuthUser extends SessionProfile {
  token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  validating: boolean;
  connecting: boolean;
  connectStep: number;
  configError: string | null;
  accessToken: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadGsi(): Promise<Window["google"]> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve(window.google);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new Error("Google Identity Services unavailable"));
    };
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [validating, setValidating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectStep, setConnectStep] = useState(0);
  const tokenClientRef = useRef<ReturnType<Window["google"]["accounts"]["oauth2"]["initTokenClient"]> | null>(null);
  const pendingResolve = useRef<((token: string) => void) | null>(null);

  // Restore + validate an existing session against Google on first load.
  useEffect(() => {
    let cancelled = false;
    const stored = session.get();
    if (!stored) {
      setInitializing(false);
      return;
    }
    if (session.isExpired(stored.expiresAt)) {
      // Temporary token expired — re-authentication requires a user gesture.
      session.clear();
      setInitializing(false);
      return;
    }
    setValidating(true);
    // Validate the real Google token against the backend me endpoint, which
    // itself validates it against Google's userinfo endpoint.
    fetch("/api/my/v1/me", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${stored.token}`,
      },
      body: JSON.stringify({}),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("me failed"))))
      .then((raw) => {
        if (cancelled) return;
        const data = raw && typeof raw === "object" && "body" in raw ? raw.body : raw;
        const acct = data?.account;
        if (!data?.ok || !acct) throw new Error("invalid session");
        const validated: SessionProfile = {
          name: acct.name,
          email: acct.email,
          avatar: acct.avatar,
          provider: acct.provider || "Google",
        };
        session.save(stored.token, Math.max(1, Math.round((stored.expiresAt - Date.now()) / 1000)), validated);
        setUser({ ...validated, token: stored.token });
      })
      .catch(() => {
        if (cancelled) return;
        session.clear();
        setUser(null);
      })
      .finally(() => {
        if (cancelled) return;
        setValidating(false);
        setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureTokenClient = useCallback(async () => {
    if (!CLIENT_ID) throw new Error("missing-client-id");
    if (tokenClientRef.current) return tokenClientRef.current;
    const google = await loadGsi();
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      prompt: "consent", // temporary: re-consent each connect
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          pendingResolve.current?.("");
          pendingResolve.current = null;
          return;
        }
        const resolve = pendingResolve.current;
        pendingResolve.current = null;
        resolve?.(resp.access_token);
      },
    });
    tokenClientRef.current = client;
    return client;
  }, []);

  const requestToken = useCallback(async (): Promise<string> => {
    const client = await ensureTokenClient();
    return new Promise<string>((resolve) => {
      pendingResolve.current = resolve;
      client.requestAccessToken({ prompt: "consent" });
      // Safety: resolve empty after 5 minutes of no response.
      setTimeout(() => {
        if (pendingResolve.current === resolve) {
          pendingResolve.current = null;
          resolve("");
        }
      }, 300_000);
    });
  }, [ensureTokenClient]);

  const loginWithGoogle = useCallback(async () => {
    if (!CLIENT_ID) return;
    setConnecting(true);
    setConnectStep(0);
    try {
      setConnectStep(1); // loading GIS / opening consent
      const token = await requestToken();
      if (!token) throw new Error("Google sign-in cancelled");
      setConnectStep(2); // fetching profile
      const info = await fetchGoogleUserinfo(token);
      const profile: SessionProfile = {
        name: info.name || info.email || "Google User",
        email: info.email || "",
        avatar: info.picture || "",
        provider: "Google",
      };
      // Gmail access lasts ~1h by default for temporary online access.
      session.save(token, 3600, profile);
      setConnectStep(3); // connecting mailbox
      setUser({ ...profile, token });
    } finally {
      setConnecting(false);
      setConnectStep(0);
    }
  }, [requestToken]);

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  const configError = !CLIENT_ID ? "VITE_GOOGLE_CLIENT_ID" : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      validating,
      connecting,
      connectStep,
      configError,
      accessToken: user?.token ?? null,
      loginWithGoogle,
      logout,
    }),
    [user, initializing, validating, connecting, connectStep, configError, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}