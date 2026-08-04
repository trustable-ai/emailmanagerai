import { useMemo } from "react";
import { marked } from "marked";
import {
  Archive,
  ArrowLeft,
  CornerUpLeft,
  CornerUpRight,
  Download,
  Forward,
  MoreHorizontal,
  Pin,
  Star,
  Trash2,
  MailOpen,
  MailX,
  Move as MoveIcon,
  Tag,
  Undo2 as RestoreIcon,
  Inbox as InboxIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Email } from "@/lib/types";
import { useMailUI } from "@/store/MailContext";
import { useEmailActions } from "@/hooks/useEmailActions";
import { useThread } from "@/hooks/useMailbox";
import type { LabelIndex } from "@/services/gmail/gmailMapper";
import {
  formatSize,
  fullName,
  fullDate,
  labelClass,
} from "@/lib/mailUtils";
import { Avatar } from "@/components/mail/Avatar";
import { ThreadSkeleton, EmptyState } from "@/components/mail/Skeletons";
import { cn } from "@/lib/utils";

marked.setOptions({ gfm: true, breaks: true });

interface ThreadViewerProps {
  selectedId: string | null;
  token: string | null;
  labelIndex: LabelIndex | null;
  loading: boolean;
}

export function ThreadViewer({ selectedId, token, labelIndex, loading }: ThreadViewerProps) {
  const {
    setSelectedId,
    setPreviewOpen,
    openComposer,
    pushMessage,
    workspaceEmails,
    activeFolder,
  } = useMailUI();
  const acts = useEmailActions();

  const selected = useMemo(
    () => workspaceEmails.find((e) => e.id === selectedId) ?? null,
    [workspaceEmails, selectedId],
  );

  const threadQuery = useThread(selected?.threadId ?? null, labelIndex, token);
  const thread = threadQuery.data ?? (selected ? [selected] : []);

  if (loading && !selected) return <ThreadSkeleton />;

  if (!selected) {
    return (
      <EmptyState
        title="Select an email"
        text="Choose a message from the list to read it here."
        icon={<MailOpen className="h-8 w-8" />}
      />
    );
  }

  const back = () => {
    setSelectedId(null);
    setPreviewOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 px-3 py-2">
        <button
          onClick={back}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <ToolBtn title="Reply" onClick={() => openComposer({ replyTo: selected })}>
          <CornerUpLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Reply</span>
        </ToolBtn>
        <ToolBtn
          title="Reply All"
          onClick={() =>
            openComposer({
              replyTo: selected,
              to: [selected.from, ...selected.to, ...selected.cc]
                .filter(Boolean)
                .map((p) => p.email)
                .join(", "),
            })
          }
        >
          <CornerUpRight className="h-4 w-4" />
          <span className="hidden lg:inline">Reply All</span>
        </ToolBtn>
        <ToolBtn title="Forward" onClick={() => openComposer({ forwardOf: selected })}>
          <Forward className="h-4 w-4" />
          <span className="hidden sm:inline">Forward</span>
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-border/60" />

        <ToolBtn title="Archive" onClick={() => acts.archive(selected)}>
          <Archive className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          title={selected.folder === "trash" ? "Restore" : "Delete"}
          onClick={() =>
            selected.folder === "trash" ? acts.restore(selected) : acts.remove(selected)
          }
        >
          {selected.folder === "trash" ? <InboxIcon className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </ToolBtn>
        <ToolBtn
          title={selected.read ? "Mark unread" : "Mark read"}
          onClick={() => acts.toggleRead(selected)}
        >
          {selected.read ? <MailX className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
        </ToolBtn>
        <ToolBtn
          title={selected.starred ? "Unstar" : "Star"}
          onClick={() => acts.toggleStar(selected)}
        >
          <Star className={cn("h-4 w-4", selected.starred && "fill-amber-400 text-amber-400")} />
        </ToolBtn>
        <ToolBtn title={selected.pinned ? "Unpin" : "Pin"} onClick={() => acts.togglePin(selected)}>
          <Pin className={cn("h-4 w-4", selected.pinned && "fill-amber-400 text-amber-400")} />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-border/60" />
        <MoveMenu onMove={(f) => acts.move(selected, f)} folder={selected.folder} />
        <LabelMenu
          labels={selected.labels}
          onAdd={(l) => acts.addLabel(selected, l)}
          onRemove={(l) => acts.removeLabel(selected, l)}
        />
        <ToolBtn
          title="More"
          onClick={() =>
            pushMessage({
              role: "system",
              kind: "system",
              content: `Opened actions for ${selected.subject}`,
            })
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </ToolBtn>
      </div>

      {/* thread */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {selected.subject || "(no subject)"}
            </h1>
            {selected.labels.map((l) => (
              <span
                key={l}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset capitalize",
                  labelClass(l),
                )}
              >
                {l}
              </span>
            ))}
          </div>

          {threadQuery.isLoading && <ThreadSkeleton />}

          <div className="space-y-3">
            {thread.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "rounded-2xl border bg-card/60 p-4 shadow-sm backdrop-blur-sm",
                  e.id === selected.id ? "border-primary/40" : "border-border/60",
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={fullName(e.from)} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-sm font-semibold">{fullName(e.from)}</p>
                      <p className="text-xs text-muted-foreground">&lt;{e.from.email}&gt;</p>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {fullDate(e.date)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      to {e.to.map((t) => fullName(t)).join(", ")}
                      {e.cc?.length ? ` · cc ${e.cc.map((c) => fullName(c)).join(", ")}` : ""}
                    </p>
                    <div
                      className="prose prose-sm mt-3 max-w-none dark:prose-invert prose-p:my-1 prose-headings:mb-1"
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(e.body || e.snippet || "_(loading body…)_") as string,
                      }}
                    />

                    {e.attachments?.length ? (
                      <div className="mt-4">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Attachments
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {e.attachments.map((a) => (
                            <div
                              key={a.name}
                              className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs"
                            >
                              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                                {a.type}
                              </span>
                              <span className="font-medium">{a.name}</span>
                              <span className="text-muted-foreground">{formatSize(a.size)}</span>
                              <button
                                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                title="Download"
                                onClick={() =>
                                  pushMessage({
                                    role: "system",
                                    kind: "system",
                                    content: `Downloaded ${a.name}`,
                                  })
                                }
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => openComposer({ replyTo: selected })}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              <CornerUpLeft className="h-4 w-4" /> Reply
            </button>
            <button
              onClick={() => openComposer({ forwardOf: selected })}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <Forward className="h-4 w-4" /> Forward
            </button>
          </div>

          {activeFolder === "trash" && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
              <RestoreIcon className="h-3.5 w-3.5" />
              This message is in Trash.
              <button onClick={() => acts.restore(selected)} className="ml-auto font-medium underline">
                Restore
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

function MoveMenu({ onMove, folder }: { onMove: (f: string) => void; folder: string }) {
  const targets = ["inbox", "spam", "trash", "archive"];
  return (
    <div className="group relative">
      <ToolBtn title="Move" onClick={() => {}}>
        <MoveIcon className="h-4 w-4" />
      </ToolBtn>
      <div className="invisible absolute right-0 z-20 mt-1 w-40 rounded-xl border border-border/60 bg-popover p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
        {targets.filter((t) => t !== folder).map((t) => (
          <button
            key={t}
            onClick={() => onMove(t)}
            className="block w-full rounded-lg px-2 py-1.5 text-left text-sm capitalize hover:bg-accent"
          >
            Move to {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function LabelMenu({
  labels,
  onAdd,
  onRemove,
}: {
  labels: string[];
  onAdd: (l: string) => void;
  onRemove: (l: string) => void;
}) {
  const preset = ["work", "personal", "invoices", "travel", "urgent", "finance", "newsletter", "family"];
  return (
    <div className="group relative">
      <ToolBtn title="Labels" onClick={() => {}}>
        <Tag className="h-4 w-4" />
      </ToolBtn>
      <div className="invisible absolute right-0 z-20 mt-1 w-44 rounded-xl border border-border/60 bg-popover p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
        {preset.map((l) => {
          const on = labels.includes(l);
          return (
            <button
              key={l}
              onClick={() => (on ? onRemove(l) : onAdd(l))}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm capitalize hover:bg-accent"
            >
              {l}
              <span className="text-[10px] text-muted-foreground">{on ? "✓" : "+"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}