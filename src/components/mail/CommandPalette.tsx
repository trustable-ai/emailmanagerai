import { useEffect } from "react";
import { Command } from "cmdk";
import {
  Archive,
  Inbox,
  Search,
  Send,
  Star,
  Trash2,
  Sparkles,
  Bot,
  MailOpen,
  PenSquare,
} from "lucide-react";
import { useMailUI } from "@/store/MailContext";
import type { Folder } from "@/lib/types";
import { useAIChat } from "@/hooks/useAIChat";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const {
    paletteOpen,
    setPaletteOpen,
    setActiveFolder,
    setSelectedId,
    setSidebarOpen,
    openComposer,
    setSearch,
  } = useMailUI();
  const { send } = useAIChat();

  // global Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen, setPaletteOpen]);

  if (!paletteOpen) return null;

  const goFolder = (f: Folder) => {
    setActiveFolder(f);
    setPaletteOpen(false);
    setSidebarOpen(false);
  };

  const ai = (prompt: string) => {
    setPaletteOpen(false);
    void send(prompt);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setPaletteOpen(false)}
    >
      <Command
        loop
        className={cn(
          "w-full max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-2xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Command.Input
            autoFocus
            placeholder="Search, jump to a folder, or ask Mailo…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onValueChange={(v) => setSearch(v)}
          />
          <kbd className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
        </div>
        <Command.List className="max-h-[50vh] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results.
          </Command.Empty>

          <Command.Group heading="Ask Mailo" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground/70">
            <CmdItem icon={Sparkles} onSelect={() => ai("Summarize today's emails")}>
              Summarize today's emails
            </CmdItem>
            <CmdItem icon={Sparkles} onSelect={() => ai("Show unread emails")}>
              Show unread emails
            </CmdItem>
            <CmdItem icon={Sparkles} onSelect={() => ai("Delete spam")}>
              Delete spam
            </CmdItem>
            <CmdItem icon={Sparkles} onSelect={() => ai("Extract deadlines")}>
              Extract deadlines
            </CmdItem>
            <CmdItem icon={Bot} onSelect={() => ai("Reply professionally to the latest email")}>
              Reply professionally to latest email
            </CmdItem>
          </Command.Group>

          <Command.Group heading="Navigate" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground/70">
            <CmdItem icon={Inbox} onSelect={() => goFolder("inbox")}>Go to Inbox</CmdItem>
            <CmdItem icon={Star} onSelect={() => goFolder("starred")}>Go to Starred</CmdItem>
            <CmdItem icon={Send} onSelect={() => goFolder("sent")}>Go to Sent</CmdItem>
            <CmdItem icon={Archive} onSelect={() => goFolder("archive")}>Go to Archive</CmdItem>
            <CmdItem icon={Trash2} onSelect={() => goFolder("trash")}>Go to Trash</CmdItem>
          </Command.Group>

          <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground/70">
            <CmdItem icon={PenSquare} onSelect={() => { setPaletteOpen(false); openComposer(); }}>
              Compose new email
            </CmdItem>
            <CmdItem icon={MailOpen} onSelect={() => { goFolder("inbox"); setSelectedId(null); }}>
              Clear selection
            </CmdItem>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

function CmdItem({
  icon: Icon,
  onSelect,
  children,
}: {
  icon: typeof Inbox;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm aria-selected:bg-accent"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{children}</span>
    </Command.Item>
  );
}