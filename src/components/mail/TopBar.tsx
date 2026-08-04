import { motion } from "framer-motion";
import {
  Menu,
  Moon,
  RefreshCw,
  Sun,
  CheckCircle2,
  CloudOff,
  Loader2,
  PanelRight,
  LogOut,
} from "lucide-react";
import { useMailUI } from "@/store/MailContext";
import { useAuth } from "@/services/auth/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { SearchBar } from "@/components/mail/SearchBar";
import { Avatar } from "@/components/mail/Avatar";
import { toast } from "sonner";
import type { Account } from "@/lib/types";

interface TopBarProps {
  account: Account;
  syncing: boolean;
  onSync: () => void;
  error?: unknown;
}

export function TopBar({ account, syncing, onSync, error }: TopBarProps) {
  const { setSidebarOpen, setChatOpen, chatOpen, notify } = useMailUI();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();

  const handleRefresh = async () => {
    onSync();
    notify({ title: "Syncing Gmail…", variant: "info" });
    toast.success("Mailbox synced");
  };

  return (
    <header className="flex items-center gap-2 border-b border-border/60 bg-background/70 px-3 py-2.5 backdrop-blur-xl sm:px-4">
      {/* mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 max-w-xl">
        <SearchBar />
      </div>

      {/* sync status */}
      <div className="hidden items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground md:flex">
        {error ? (
          <>
            <CloudOff className="h-3.5 w-3.5 text-rose-500" />
            <span>Offline</span>
          </>
        ) : syncing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Syncing…</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Gmail synced</span>
          </>
        )}
      </div>

      {/* actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          aria-label="Refresh"
          title="Refresh"
        >
          <motion.span
            animate={syncing ? { rotate: 360 } : { rotate: 0 }}
            transition={syncing ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0.2 }}
            className="inline-flex"
          >
            <RefreshCw className="h-4 w-4" />
          </motion.span>
        </button>

        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`rounded-lg p-2 hover:bg-accent hover:text-foreground lg:hidden ${
            chatOpen ? "text-primary" : "text-muted-foreground"
          }`}
          aria-label="Toggle AI assistant"
        >
          <PanelRight className="h-4 w-4" />
        </button>

        {/* account chip */}
        <div className="ml-1 hidden items-center gap-2 rounded-full border border-border/60 bg-muted/40 py-1 pl-1 pr-3 sm:flex">
          <Avatar name={account.name} size="sm" />
          <div className="leading-tight">
            <p className="max-w-[140px] truncate text-xs font-medium">{account.email}</p>
          </div>
          <button
            onClick={logout}
            className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Disconnect account"
            title="Disconnect"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}