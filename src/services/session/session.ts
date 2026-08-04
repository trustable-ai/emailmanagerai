// Browser-side session persistence for the real Google OAuth flow.
//
// We store the real Google access token (short-lived, "temporary" OAuth),
// its expiry, and the display profile. The token is sent to the backend `v1/me`
// endpoint on every full-page load to validate it against Google — the backend
// (not localStorage) is the source of truth. This module is the single place
// that touches storage for auth so the strategy can evolve without touching
// the rest of the UI.

const TOKEN_KEY = "mailo.session.token";
const EXP_KEY = "mailo.session.exp";
const PROFILE_KEY = "mailo.session.profile";

export interface SessionProfile {
  name: string;
  email: string;
  avatar: string;
  provider: string;
}

export interface StoredSession {
  token: string;
  expiresAt: number; // epoch ms
  profile: SessionProfile;
}

export const session = {
  get(): StoredSession | null {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const exp = Number(localStorage.getItem(EXP_KEY) || 0);
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!token || !raw) return null;
      const profile = JSON.parse(raw) as SessionProfile;
      return { token, expiresAt: exp, profile };
    } catch {
      return null;
    }
  },

  save(token: string, expiresInSec: number, profile: SessionProfile): void {
    try {
      const expiresAt = Date.now() + expiresInSec * 1000;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(EXP_KEY, String(expiresAt));
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EXP_KEY);
      localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }
  },

  isExpired(expiresAt: number, skewMs = 60_000): boolean {
    return Date.now() + skewMs >= expiresAt;
  },
};