// Browser-side session persistence. The app currently uses a temporary
// mock Google sign-in (no backend secrets are available); the session stores
// an opaque token plus a display profile. This module is the single place that
// touches localStorage for auth so the auth strategy can be replaced later
// (e.g. real Google OAuth + Redis-backed server sessions) without touching the
// rest of the UI.

const TOKEN_KEY = "mailo.session.token";
const PROFILE_KEY = "mailo.session.profile";

export interface SessionProfile {
  name: string;
  email: string;
  avatar: string;
  provider: string;
}

export const session = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  getProfile(): SessionProfile | null {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? (JSON.parse(raw) as SessionProfile) : null;
    } catch {
      return null;
    }
  },

  save(token: string, profile: SessionProfile): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* ignore quota errors */
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }
  },

  /** Generate a cryptographically random opaque token. */
  createToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  },
};