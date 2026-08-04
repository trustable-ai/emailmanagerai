// Authentication context — temporary Google OAuth (mock).
//
// Real Google OAuth requires a client id/secret that live in the immutable
// application environment, which only the user can set through the Trustable
// configuration UI. Until those credentials exist we provide an isolated,
// swappable mock that performs a realistic "Continue with Google" flow and
// signs in with the mailbox's demo Google account. Replace `mockGoogleLogin`
// with a real `google.accounts.oauth2` flow and a server session exchange to
// go live — the rest of the app only depends on the AuthContext surface.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { session, type SessionProfile } from "@/services/session/session";
import { fetchMailbox } from "@/services/api/client";

export interface AuthUser extends SessionProfile {
  token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  validating: boolean;
  connecting: boolean;
  connectStep: number;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Simulated Google account picker / consent -> returns a Google profile. */
async function mockGoogleLogin(): Promise<SessionProfile> {
  // Simulate the popup + network round-trip latency.
  await new Promise((r) => setTimeout(r, 900));
  // The demo mailbox is a Google account (alex.carter@gmail.com). In a real
  // integration this profile comes from the Google userinfo endpoint.
  const snap = await fetchMailbox().catch(() => null);
  const acct = snap?.account;
  return {
    name: acct?.name ?? "Alex Carter",
    email: acct?.email ?? "alex.carter@gmail.com",
    avatar: acct?.avatar ?? "AC",
    provider: acct?.provider ?? "Google",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [validating, setValidating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectStep, setConnectStep] = useState(0);

  // Restore + validate an existing session on first load. A persisted opaque
  // token must be validated against the backend before granting access; on
  // any validation failure the token and cached profile are cleared and the
  // public authentication flow is shown.
  useEffect(() => {
    let cancelled = false;
    const token = session.getToken();
    const profile = session.getProfile();
    if (!token || !profile) {
      setInitializing(false);
      return;
    }
    setValidating(true);
    // Validate the persisted opaque token against the backend me/session
    // endpoint before granting access. The token is sent in an Authorization
    // header so the backend (not localStorage) is the source of truth.
    fetch("/api/my/v1/me", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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
          provider: acct.provider,
        };
        session.save(token, validated);
        setUser({ ...validated, token });
      })
      .catch(() => {
        if (cancelled) return;
        // Invalid/expired token: clear and force re-authentication.
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

  const loginWithGoogle = useCallback(async () => {
    setConnecting(true);
    setConnectStep(0);
    try {
      // Simulated OAuth consent + Gmail connect progress.
      const steps = [
        "Authorizing with Google",
        "Granting Gmail scopes",
        "Connecting mailbox",
      ];
      for (let i = 0; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 450));
        setConnectStep(i + 1);
      }
      const profile = await mockGoogleLogin();
      const token = session.createToken();
      session.save(token, profile);
      setUser({ ...profile, token });
    } finally {
      setConnecting(false);
      setConnectStep(0);
    }
  }, []);

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      validating,
      connecting,
      connectStep,
      loginWithGoogle,
      logout,
    }),
    [user, initializing, validating, connecting, connectStep, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}