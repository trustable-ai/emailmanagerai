import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Paperclip,
  Send,
  Save,
  Trash2,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
} from "lucide-react";
import { useMailUI } from "@/store/MailContext";
import { useEmailActions } from "@/hooks/useEmailActions";
import { fullName } from "@/lib/mailUtils";
import type { Attachment } from "@/lib/types";
import { Avatar } from "@/components/mail/Avatar";
import { useAuth } from "@/services/auth/AuthContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function Composer() {
  const { composer, closeComposer } = useMailUI();
  const acts = useEmailActions();
  const { user } = useAuth();

  const initial = (() => {
    const r = composer.replyTo;
    const f = composer.forwardOf;
    if (r) {
      return {
        to: composer.to || r.from.email,
        subject: r.subject.startsWith("Re:") ? r.subject : `Re: ${r.subject}`,
        body: `\n\n---\nOn ${r.date}, ${fullName(r.from)} wrote:\n${r.body}`,
      };
    }
    if (f) {
      return {
        to: composer.to || "",
        subject: `Fwd: ${f.subject}`,
        body: `\n\n---------- Forwarded message ----------\nFrom: ${fullName(f.from)} <${f.from.email}>\nDate: ${f.date}\nSubject: ${f.subject}\n\n${f.body}`,
      };
    }
    return {
      to: composer.to || "",
      subject: composer.subject || "",
      body: composer.body || "",
    };
  })();

  const [to, setTo] = useState(initial.to);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const wrapSelection = (before: string, after: string = before) => {
    const ta = dropRef.current?.querySelector("textarea") as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = body;
    const next = val.slice(0, start) + before + val.slice(start, end) + after + val.slice(end);
    setBody(next);
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = Array.from(files).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.name.split(".").pop() || "file",
    }));
    setAttachments((prev) => [...prev, ...next]);
    toast.success(`Attached ${next.length} file(s)`);
  };

  const onSend = async () => {
    if (!to.trim()) {
      toast.error("Add a recipient");
      return;
    }
    await acts.send(to, subject, body);
    closeComposer();
  };
  const onSaveDraft = async () => {
    await acts.saveDraft(subject, body);
    closeComposer();
  };

  const previewTo = to.split(",")[0]?.trim() || "";

  return (
    <Dialog open={composer.open} onOpenChange={(o) => !o && closeComposer()}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">Compose email</DialogTitle>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col overflow-hidden rounded-2xl"
          ref={dropRef}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
        >
          {/* header */}
          <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
            <Avatar name={user?.name ?? "U"} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-medium">{user?.email}</p>
              <p className="truncate text-[11px] text-muted-foreground">New message</p>
            </div>
            <button
              onClick={closeComposer}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {dragOver && (
            <div className="border-y-2 border-dashed border-primary bg-primary/10 px-4 py-6 text-center text-sm font-medium text-primary">
              Drop files to attach
            </div>
          )}

          {/* fields */}
          <div className="flex flex-col divide-y divide-border/40">
            <div className="flex items-center gap-2 px-4 py-2">
              <label htmlFor="cmp-to" className="w-12 text-xs text-muted-foreground">To</label>
              <input
                id="cmp-to"
                name="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder="recipient@email.com"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2">
              <label htmlFor="cmp-subject" className="w-12 text-xs text-muted-foreground">Subject</label>
              <input
                id="cmp-subject"
                name="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 bg-transparent text-sm font-medium outline-none"
                placeholder="Subject"
              />
            </div>
          </div>

          {/* formatting toolbar */}
          <div className="flex items-center gap-1 border-b border-border/60 px-3 py-1.5">
            <FmtBtn title="Bold" onClick={() => wrapSelection("**")}><Bold className="h-3.5 w-3.5" /></FmtBtn>
            <FmtBtn title="Italic" onClick={() => wrapSelection("*")}><Italic className="h-3.5 w-3.5" /></FmtBtn>
            <FmtBtn title="List" onClick={() => setBody((b) => b + "\n- ")}><List className="h-3.5 w-3.5" /></FmtBtn>
            <FmtBtn title="Link" onClick={() => wrapSelection("[", "](https://)")}><LinkIcon className="h-3.5 w-3.5" /></FmtBtn>
            <label htmlFor="cmp-attach" className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              <Paperclip className="h-3.5 w-3.5" /> Attach
              <input
                type="file"
                id="cmp-attach"
                name="cmp-attach"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
          </div>

          {/* body */}
          <label htmlFor="cmp-body" className="sr-only">Message body</label>
          <textarea
            id="cmp-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write your message…"
            className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none"
          />

          {/* attachments preview */}
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-border/60 px-4 py-2"
              >
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a, i) => (
                    <div
                      key={`${a.name}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-xs"
                    >
                      <span className="rounded bg-primary/10 px-1 text-[10px] font-semibold uppercase text-primary">
                        {a.type}
                      </span>
                      <span className="font-medium">{a.name}</span>
                      <button
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Remove attachment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* footer */}
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
            <div className="text-[11px] text-muted-foreground">
              {previewTo && <>to {previewTo}</>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onSaveDraft}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm hover:bg-muted"
              >
                <Save className="h-3.5 w-3.5" /> Save draft
              </button>
              <button
                onClick={onSend}
                disabled={acts.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-cyan-500 px-4 py-1.5 text-sm font-medium text-white shadow disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> Send
              </button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function FmtBtn({
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
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}