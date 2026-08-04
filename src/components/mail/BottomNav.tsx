import { Inbox, Search, Sparkles, PenSquare, Bell } from "lucide-react";
import { useMailUI } from "@/store/MailContext";
import { useMailbox } from "@/hooks/useMailbox";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom navigation: quick switching between mailbox list, search,
 * AI assistant and compose. Shown only on small screens.
 */
export function BottomNav() {
  const { setPaletteOpen, setChatOpen, chatOpen, openComposer, setActiveFolder, activeFolder, setSidebarOpen } =
    useMailUI();
  const { data } = useMailbox();
  const unread = (data?.counts?.unread as number) ?? 0;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border/60 bg-background/90 px-2 py-1.5 backdrop-blur-xl lg:hidden">
      <BottomBtn
        icon={Inbox}
        label="Mail"
        active={activeFolder === "inbox"}
        badge={unread}
        onClick={() => {
          setActiveFolder("inbox");
          setSidebarOpen(true);
        }}
      />
      <BottomBtn icon={Search} label="Search" onClick={() => setPaletteOpen(true)} />
      <BottomBtn
        icon={PenSquare}
        label="Compose"
        onClick={() => openComposer()}
        accent
      />
      <BottomBtn
        icon={Sparkles}
        label="AI"
        active={chatOpen}
        onClick={() => setChatOpen(!chatOpen)}
      />
      <BottomBtn icon={Bell} label="Alerts" onClick={() => {}} />
    </nav>
  );
}

function BottomBtn({
  icon: Icon,
  label,
  active,
  badge,
  accent,
  onClick,
}: {
  icon: typeof Inbox;
  label: string;
  active?: boolean;
  badge?: number;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-medium transition-colors",
        accent
          ? "text-primary"
          : active
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("h-5 w-5", accent && "fill-primary/10")} />
      {badge ? (
        <span className="absolute right-1 top-0 rounded-full bg-primary px-1 text-[8px] text-primary-foreground">
          {badge}
        </span>
      ) : null}
      {label}
    </button>
  );
}