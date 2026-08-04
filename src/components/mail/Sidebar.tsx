import { motion, AnimatePresence } from "framer-motion";
import {
  Archive,
  FileText,
  Inbox,
  Mailbox,
  Pin,
  Send,
  Settings,
  Star,
  Trash2,
  X,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type { Folder } from "@/lib/types";
import { useMailUI } from "@/store/MailContext";
import {
  FOLDER_LABELS,
  unreadForFolder,
} from "@/lib/mailUtils";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/mail/Avatar";
import { useAuth } from "@/services/auth/AuthContext";

interface SidebarProps {
  counts: Record<string, number>;
  labels: string[];
  allEmails: { id: string; read: boolean; folder: string; starred: boolean; pinned: boolean; priority: string; labels: string[] }[];
}

const FOLDER_ITEMS: { key: Folder; icon: typeof Inbox }[] = [
  { key: "inbox", icon: Inbox },
  { key: "starred", icon: Star },
  { key: "important", icon: Pin },
  { key: "sent", icon: Send },
  { key: "drafts", icon: FileText },
  { key: "spam", icon: AlertTriangle },
  { key: "trash", icon: Trash2 },
  { key: "archive", icon: Archive },
];

export function Sidebar({ counts, labels, allEmails }: SidebarProps) {
  const {
    activeFolder,
    setActiveFolder,
    setSidebarOpen,
    openComposer,
  } = useMailUI();
  const { user, logout } = useAuth();

  const select = (f: Folder) => {
    setActiveFolder(f);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-full flex-col border-r border-border/60 bg-sidebar/60 backdrop-blur-xl">
      {/* brand */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-500 text-white shadow">
            <Mailbox className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Mailo</p>
            <p className="text-[11px] text-muted-foreground">AI Email</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* compose */}
      <div className="px-3 pb-2">
        <button
          onClick={() => openComposer()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg hover:brightness-105"
        >
          <Sparkles className="h-4 w-4" />
          Compose
        </button>
      </div>

      {/* folders */}
      <nav className="mt-1 flex-1 overflow-y-auto px-2 py-2">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Mailbox
        </p>
        <ul className="space-y-0.5">
          {FOLDER_ITEMS.map(({ key, icon: Icon }) => {
            const active = activeFolder === key;
            const unread = unreadForFolder(allEmails as never, key);
            const total = counts[key] ?? 0;
            return (
              <li key={key}>
                <button
                  onClick={() => select(key)}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  <span className="flex-1 text-left">{FOLDER_LABELS[key]}</span>
                  {unread > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {unread}
                    </span>
                  )}
                  {unread === 0 && total > 0 && key !== "inbox" && (
                    <span className="text-[11px] text-muted-foreground/70">
                      {total}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* labels */}
        <p className="mt-4 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Labels
        </p>
        <ul className="space-y-0.5">
          <AnimatePresence initial={false}>
            {labels.map((l) => (
              <motion.li
                key={l}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  onClick={() => {
                    setActiveFolder("inbox");
                    setSidebarOpen(false);
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-primary/70 to-cyan-500/70" />
                  <span className="flex-1 text-left capitalize">{l}</span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </nav>

      {/* account */}
      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-sidebar-accent/60">
          <Avatar name={user?.name ?? "U"} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={logout}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Disconnect"
              aria-label="Disconnect account"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}