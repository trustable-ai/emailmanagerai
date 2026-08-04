import { Search, Command } from "lucide-react";
import { useMailUI } from "@/store/MailContext";

interface SearchBarProps {
  onTriggerCommand?: () => void;
}

export function SearchBar({ onTriggerCommand }: SearchBarProps) {
  const { search, setSearch, setPaletteOpen } = useMailUI();
  return (
    <button
      onClick={() => {
        setPaletteOpen(true);
        onTriggerCommand?.();
      }}
      className="group flex w-full items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Search className="h-4 w-4 shrink-0" />
      <label htmlFor="mail-search" className="sr-only">Search mail</label>
      <input
        id="mail-search"
        name="mail-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder="Search mail or ask the assistant…"
        className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        aria-label="Search mail"
      />
      <kbd className="hidden items-center gap-1 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
        <Command className="h-3 w-3" />K
      </kbd>
    </button>
  );
}