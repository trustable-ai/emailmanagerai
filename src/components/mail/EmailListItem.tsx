import { motion } from "framer-motion";
import { Paperclip, Star, Pin, AlertCircle } from "lucide-react";
import type { Email } from "@/lib/types";
import { useMailUI } from "@/store/MailContext";
import {
  fullName,
  labelClass,
  relativeTime,
} from "@/lib/mailUtils";
import { Avatar } from "@/components/mail/Avatar";
import { cn } from "@/lib/utils";

interface EmailListItemProps {
  email: Email;
  index: number;
}

export function EmailListItem({ email, index }: EmailListItemProps) {
  const { selectedId, setSelectedId, setPreviewOpen } = useMailUI();
  const selected = selectedId === email.id;

  const open = () => {
    setSelectedId(email.id);
    setPreviewOpen(true);
  };

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.2) }}
      onClick={open}
      className={cn(
        "group relative flex w-full gap-3 rounded-xl border px-3 py-3 text-left transition-all",
        selected
          ? "border-primary/40 bg-primary/10 shadow-sm"
          : "border-transparent hover:border-border/60 hover:bg-muted/50",
      )}
    >
      {/* unread bar */}
      {!email.read && (
        <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
      )}

      <Avatar name={fullName(email.from)} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-sm",
              !email.read ? "font-semibold text-foreground" : "font-medium text-foreground/80",
            )}
          >
            {fullName(email.from)}
          </p>
          {email.priority === "high" && (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
          )}
          {email.pinned && (
            <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )}
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
            {relativeTime(email.date)}
          </span>
        </div>

        <p
          className={cn(
            "mt-0.5 truncate text-sm",
            !email.read ? "font-medium text-foreground" : "text-foreground/75",
          )}
        >
          {email.subject || "(no subject)"}
        </p>

        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {email.snippet}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {email.labels.slice(0, 3).map((l) => (
            <span
              key={l}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset capitalize",
                labelClass(l),
              )}
            >
              {l}
            </span>
          ))}
          {email.attachments?.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              {email.attachments.length}
            </span>
          )}
          {email.starred && (
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          )}
        </div>
      </div>
    </motion.button>
  );
}