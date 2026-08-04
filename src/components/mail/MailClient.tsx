import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo } from "react";
import { Loader2, WifiOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/services/auth/AuthContext";
import { useMailbox, useMailCounts, useRefreshMail } from "@/hooks/useMailbox";
import { useMailUI } from "@/store/MailContext";
import type { Folder } from "@/lib/types";
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
  const { user, accessToken } = useAuth();
  const {
    activeFolder,
    sidebarOpen,
    chatOpen,
    previewOpen,
    selectedId,
    setSidebarOpen,
    setChatOpen,
    setLabelIndex,
    setWorkspaceEmails,
  } = useMailUI();

  const token = accessToken;
  const mailbox = useMailbox(activeFolder as Folder, token);
  const counts = useMailCounts(token);
  const refresh = useRefreshMail(token);
  const syncing = mailbox.isFetching && !mailbox.isLoading;

  // Share the Gmail label index + the active folder's emails with the rest of
  // the app (actions, AI router, thread viewer).
  useEffect(() => {
    if (mailbox.data?.labelIndex) setLabelIndex(mailbox.data.labelIndex);
  }, [mailbox.data?.labelIndex, setLabelIndex]);
  useEffect(() => {
    setWorkspaceEmails(mailbox.data?.emails ?? []);
  }, [mailbox.data?.emails, setWorkspaceEmails]);

  const sidebarEmails = useMemo(
    () => (mailbox.data?.emails ?? []).map((e) => ({
      id: e.id, read: e.read, folder: e.folder, starred: e.starred,
      pinned: e.pinned, priority: e.priority, labels: e.labels,
    })),
    [mailbox.data?.emails],
  );

  const account = user
    ? { name: user.name, email: user.email, avatar: user.avatar, provider: user.provider }
    : { name: "", email: "", avatar: "", provider: "Google" };

  if (mailbox.error && !mailbox.data) {
    const isAuth = (mailbox.error as Error)?.name === "GauthError";
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <EmptyState
          title={isAuth ? "Google session expired" : "Can't reach Gmail"}
          text={isAuth
            ? "Your temporary Google access has expired. Please sign in again."
            : "Your mailbox couldn't be loaded. Check the connection and try again."}
          icon={<WifiOff className="h-8 w-8" />}
          action={
            <button
              onClick={() => refresh()}
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
      <TopBar account={account} syncing={syncing} onSync={refresh} error={mailbox.error} />

      <div className="relative flex flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 lg:block">
          <Sidebar
            counts={counts.data ?? {}}
            labels={mailbox.data?.labels ?? []}
            allEmails={sidebarEmails as never}
          />
        </aside>

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
                <Sidebar
                  counts={counts.data ?? {}}
                  labels={mailbox.data?.labels ?? []}
                  allEmails={sidebarEmails as never}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="flex flex-1 overflow-hidden">
          <section
            className={`${selectedId && previewOpen ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-border/60 md:w-96`}
          >
            <EmailList
              emails={mailbox.data?.emails ?? []}
              loading={mailbox.isLoading}
              error={mailbox.error}
            />
          </section>

          <section
            className={`${selectedId && previewOpen ? "flex" : "hidden md:flex"} flex-1 flex-col`}
          >
            <ThreadViewer
              selectedId={selectedId}
              token={token}
              labelIndex={mailbox.data?.labelIndex ?? null}
              loading={mailbox.isLoading}
            />
          </section>
        </main>

        <aside className="hidden w-96 shrink-0 border-l border-border/60 xl:block">
          <AIChat />
        </aside>

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

      <FloatingCompose />
      <BottomNav />

      <AnimatePresence>
        {mailbox.isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading your Gmail…</p>
              <p className="text-xs text-muted-foreground">Fetching messages from {activeFolder}</p>
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
      <span className="text-xl leading-none">+</span>
    </motion.button>
  );
}