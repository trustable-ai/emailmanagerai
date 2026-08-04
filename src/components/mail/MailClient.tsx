import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import { Sparkles, Loader2, WifiOff, RefreshCw } from "lucide-react";
import { useMailbox } from "@/hooks/useMailbox";
import { useMailUI } from "@/store/MailContext";
import { Sidebar } from "@/components/mail/Sidebar";
import { TopBar } from "@/components/mail/TopBar";
import { EmailList } from "@/components/mail/EmailList";
import { ThreadViewer } from "@/components/mail/ThreadViewer";
import { AIChat } from "@/components/mail/AIChat";
import { Composer } from "@/components/mail/Composer";
import { CommandPalette } from "@/components/mail/CommandPalette";
import { NotificationCenter } from "@/components/mail/NotificationCenter";
import { BottomNav } from "@/components/mail/BottomNav";
import { EmptyState } from "@/components/mail/Skeletons";

export function MailClient() {
  const { data, isLoading, isFetching, error, refetch } = useMailbox();
  const { sidebarOpen, chatOpen, previewOpen, selectedId, setSidebarOpen, setChatOpen } = useMailUI();

  const account = data?.account;
  const labels = data?.labels ?? [];
  const emails = data?.emails ?? [];
  const counts = data?.counts ?? {};
  const syncing = isFetching && !isLoading;

  const sidebarEmails = useMemo(
    () => emails.map((e) => ({
      id: e.id,
      read: e.read,
      folder: e.folder,
      starred: e.starred,
      pinned: e.pinned,
      priority: e.priority,
      labels: e.labels,
    })),
    [emails],
  );

  // Gmail connect / first-load error state.
  if (error && !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <EmptyState
          title="Can't reach Gmail"
          text="Your mailbox couldn't be loaded. Check the connection and try again."
          icon={<WifiOff className="h-8 w-8" />}
          action={
            <button
              onClick={() => refetch()}
              className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* floating AI button (mobile) — kept for layout parity */}
      <span className="hidden" aria-hidden />

      <TopBar account={account ?? { name: "", email: "", avatar: "", provider: "Google", lastSync: "" }} syncing={syncing} onSync={() => refetch()} error={error} />

      <div className="relative flex flex-1 overflow-hidden">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Sidebar counts={counts} labels={labels} allEmails={sidebarEmails as never} />
        </aside>

        {/* MOBILE SIDEBAR DRAWER */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              />
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden"
              >
                <Sidebar counts={counts} labels={labels} allEmails={sidebarEmails as never} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* MIDDLE: list + preview */}
        <main className="flex flex-1 overflow-hidden">
          {/* Email list — hidden on mobile when a thread is open */}
          <section
            className={`${
              selectedId && previewOpen ? "hidden md:flex" : "flex"
            } w-full shrink-0 flex-col border-r border-border/60 md:w-96`}
          >
            <EmailList emails={emails} loading={isLoading} error={error} />
          </section>

          {/* Thread viewer — mobile slides over */}
          <section
            className={`${
              selectedId && previewOpen ? "flex" : "hidden md:flex"
            } flex-1 flex-col`}
          >
            <ThreadViewer emails={emails} selectedId={selectedId} loading={isLoading} />
          </section>
        </main>

        {/* DESKTOP AI CHAT */}
        <aside className="hidden w-96 shrink-0 border-l border-border/60 xl:block">
          <AIChat />
        </aside>

        {/* MOBILE AI CHAT DRAWER */}
        <AnimatePresence>
          {chatOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setChatOpen(false)}
                className="fixed inset-0 z-40 bg-black/40 xl:hidden"
              />
              <motion.aside
                initial={{ x: 420 }}
                animate={{ x: 0 }}
                exit={{ x: 420 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="fixed inset-y-0 right-0 z-50 w-full max-w-sm xl:hidden"
              >
                <AIChat />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* floating compose button */}
      <FloatingCompose />

      <BottomNav />

      {/* first-load sync overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Connecting to Gmail…</p>
              <p className="text-xs text-muted-foreground">Syncing your mailbox</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Composer />
      <CommandPalette />
      <div className="fixed right-4 top-16 z-40">
        <NotificationCenter />
      </div>
    </div>
  );
}

function FloatingCompose() {
  const { openComposer } = useMailUI();
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
      onClick={() => openComposer()}
      className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-cyan-500 text-white shadow-lg shadow-primary/30 hover:brightness-105 lg:bottom-6 xl:right-[27rem]"
      aria-label="Compose"
      title="Compose"
    >
      <Sparkles className="h-5 w-5" />
    </motion.button>
  );
}