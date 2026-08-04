import { motion } from "framer-motion";
import { Mail, ShieldCheck, Sparkles, Zap, AlertTriangle, KeyRound } from "lucide-react";
import { useAuth } from "@/services/auth/AuthContext";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

const features = [
  { icon: Sparkles, title: "AI email assistant", text: "Summarize, reply, translate and triage with one prompt." },
  { icon: Zap, title: "Two-way control", text: "Every action works from the UI or the chat — always in sync." },
  { icon: ShieldCheck, title: "Private by design", text: "Temporary Google sign-in. Disconnect anytime." },
];

export function Login() {
  const { loginWithGoogle, connecting, connectStep, configError } = useAuth();
  const steps = ["Opening Google consent", "Fetching your profile", "Connecting mailbox"];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md rounded-3xl border border-border/60 bg-card/70 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ rotate: -8, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cyan-500 text-white shadow-lg"
          >
            <Mail className="h-8 w-8" />
          </motion.div>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Mailo
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your AI-powered email workspace
          </p>
        </div>

        <ul className="mb-8 space-y-3">
          {features.map((f, i) => (
            <motion.li
              key={f.title}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/50 p-3"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.text}</p>
              </div>
            </motion.li>
          ))}
        </ul>

        {configError ? (
          <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Google OAuth is not configured
            </div>
            <p className="text-muted-foreground">
              To use real Google sign-in, set the OAuth client id in the app
              environment as <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_GOOGLE_CLIENT_ID</code>{" "}
              through the Trustable configuration UI, then reload.
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-background/60 p-2 text-xs text-muted-foreground">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                In Google Cloud Console create an OAuth 2.0 Client (Web), add this
                app origin to <strong>Authorized JavaScript origins</strong>, and
                copy the Client ID. No client secret is required — the sign-in uses
                Google Identity Services (temporary, consent-based access).
              </span>
            </div>
          </div>
        ) : connecting ? (
          <div className="space-y-3 rounded-xl border border-border/60 bg-background/60 p-4">
            {steps.map((s, i) => {
              const active = i < connectStep;
              const current = i === connectStep;
              return (
                <div key={s} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                      active
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : current
                          ? "border-primary text-primary"
                          : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {active ? "✓" : current ? "•" : ""}
                  </span>
                  <span className={active ? "text-muted-foreground line-through" : current ? "font-medium" : "text-muted-foreground"}>
                    {s}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <button
            onClick={loginWithGoogle}
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-border/70 bg-background px-4 py-3.5 text-sm font-medium shadow-sm transition-all hover:bg-muted hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <GoogleMark className="h-5 w-5" />
            Continue with Google
          </button>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          Real Google OAuth via Google Identity Services. We never see or store
          your password. Gmail access is temporary and can be revoked anytime from
          your Google account.
        </p>
      </motion.div>
    </div>
  );
}