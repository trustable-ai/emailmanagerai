import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Info, AlertCircle, X } from "lucide-react";
import { useMailUI } from "@/store/MailContext";
import { relativeTime } from "@/lib/mailUtils";
import { cn } from "@/lib/utils";

const variantIcon = {
  success: Check,
  error: AlertCircle,
  info: Info,
  default: Info,
};

export function NotificationCenter() {
  const { notifications, dismissNotification, clearNotifications } = useMailUI();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {notifications.length > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <p className="text-sm font-semibold">Notifications</p>
                <button
                  onClick={clearNotifications}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Clear all
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    You're all caught up 🎉
                  </p>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {notifications.map((n) => {
                      const Icon = variantIcon[n.variant];
                      return (
                        <li
                          key={n.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40"
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                              n.variant === "success" && "bg-emerald-500/15 text-emerald-500",
                              n.variant === "error" && "bg-rose-500/15 text-rose-500",
                              n.variant === "info" && "bg-primary/15 text-primary",
                              n.variant === "default" && "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{n.title}</p>
                            {n.description && (
                              <p className="text-xs text-muted-foreground">{n.description}</p>
                            )}
                            <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                              {relativeTime(new Date(n.ts).toISOString())}
                            </p>
                          </div>
                          <button
                            onClick={() => dismissNotification(n.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="Dismiss"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}