import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { marked } from "marked";
import {
  Sparkles,
  Send,
  Square,
  Trash2,
  Bot,
  User as UserIcon,
  Zap,
} from "lucide-react";
import { useAIChat } from "@/hooks/useAIChat";
import { useMailUI } from "@/store/MailContext";
import { cn } from "@/lib/utils";

marked.setOptions({ gfm: true, breaks: true });

const SUGGESTIONS = [
  "Summarize today's emails",
  "Show unread emails",
  "Find emails from John",
  "Show attachments",
  "Delete spam",
  "Extract deadlines",
  "Reply professionally to eml-003",
  "Translate eml-005 to Italian",
];

export function AIChat() {
  const { send, stop, reset, isStreaming, messages } = useAIChat();
  const { setSelectedId, selectedId } = useMailUI();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || isStreaming) return;
    setInput("");
    void send(t);
  };

  return (
    <div className="flex h-full flex-col bg-sidebar/40 backdrop-blur-xl">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-500 text-white shadow">
            <Bot className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Mailo Assistant</p>
            <p className="text-[11px] text-muted-foreground">
              {selectedId ? `Context: ${selectedId}` : "Email AI"}
            </p>
          </div>
        </div>
        <button
          onClick={reset}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Clear conversation"
          aria-label="Clear conversation"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cyan-500 text-white shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">Your AI email assistant</p>
              <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                Summarize, reply, translate, triage — anything email, just ask.
              </p>
            </div>
            <div className="grid w-full max-w-[260px] grid-cols-1 gap-1.5">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  <Zap className="h-3 w-3 shrink-0 text-primary" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "flex gap-2",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {m.role !== "user" && (
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white",
                      m.kind === "action"
                        ? "bg-emerald-500"
                        : "bg-gradient-to-br from-primary to-cyan-500",
                    )}
                  >
                    {m.kind === "action" ? (
                      <Zap className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : m.kind === "action"
                        ? "bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/20"
                        : "bg-muted text-foreground",
                  )}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-li:my-0"
                      dangerouslySetInnerHTML={{
                        __html:
                          marked.parse(m.content || "") as string,
                      }}
                    />
                  )}
                  {m.pending && !m.content && (
                    <span className="flex gap-1 py-1">
                      <Dot /> <Dot d={0.1} /> <Dot d={0.2} />
                    </span>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* quick suggestions */}
      {messages.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-3 py-2">
          {SUGGESTIONS.slice(4).map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              disabled={isStreaming}
              className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex items-end gap-2 border-t border-border/60 p-3"
      >
        <textarea
          id="ai-input"
          name="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          rows={1}
          placeholder="Ask Mailo to summarize, reply, archive…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ask the assistant"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            aria-label="Stop"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-500 text-white shadow disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}

function Dot({ d = 0 }: { d?: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
      style={{ animationDelay: `${d}s` }}
    />
  );
}