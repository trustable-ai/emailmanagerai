import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppNotification, ChatMessage, Email, Folder } from "@/lib/types";
import type { LabelIndex } from "@/services/gmail/gmailMapper";

interface ComposerState {
  open: boolean;
  replyTo?: Email | null;
  forwardOf?: Email | null;
  to?: string;
  subject?: string;
  body?: string;
}

interface MailUIContextValue {
  // selection & navigation
  activeFolder: Folder;
  setActiveFolder: (f: Folder) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  search: string;
  setSearch: (s: string) => void;
  // panels (mobile drawers)
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  previewOpen: boolean;
  setPreviewOpen: (v: boolean) => void;
  // command palette
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  // composer
  composer: ComposerState;
  openComposer: (partial?: Partial<ComposerState>) => void;
  closeComposer: () => void;
  // chat
  messages: ChatMessage[];
  pushMessage: (m: Omit<ChatMessage, "id">) => ChatMessage;
  updateMessage: (id: number, patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  // notifications
  notifications: AppNotification[];
  notify: (n: Omit<AppNotification, "id" | "ts">) => void;
  dismissNotification: (id: number) => void;
  clearNotifications: () => void;
  // gmail label map shared with actions/AI
  labelIndex: LabelIndex | null;
  setLabelIndex: (idx: LabelIndex | null) => void;
  // all loaded emails across folders (for AI client-side queries)
  setWorkspaceEmails: (emails: Email[]) => void;
  workspaceEmails: Email[];
}

const MailUIContext = createContext<MailUIContextValue | undefined>(undefined);

let idCounter = 1;
const nextId = () => idCounter++;

export function MailUIProvider({ children }: { children: ReactNode }) {
  const [activeFolder, setActiveFolder] = useState<Folder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>({ open: false });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [labelIndex, setLabelIndex] = useState<LabelIndex | null>(null);
  const [workspaceEmails, setWorkspaceEmails] = useState<Email[]>([]);

  const pushMessage = useCallback((m: Omit<ChatMessage, "id">) => {
    const msg: ChatMessage = { id: nextId(), ...m };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const updateMessage = useCallback(
    (id: number, patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
    },
    [],
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  const notify = useCallback((n: Omit<AppNotification, "id" | "ts">) => {
    const item: AppNotification = { id: nextId(), ts: Date.now(), ...n };
    setNotifications((prev) => [item, ...prev].slice(0, 50));
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const openComposer = useCallback((partial?: Partial<ComposerState>) => {
    setComposer({ open: true, ...partial });
  }, []);
  const closeComposer = useCallback(() => {
    setComposer({ open: false });
  }, []);

  const value = useMemo<MailUIContextValue>(
    () => ({
      activeFolder,
      setActiveFolder,
      selectedId,
      setSelectedId,
      search,
      setSearch,
      sidebarOpen,
      setSidebarOpen,
      chatOpen,
      setChatOpen,
      previewOpen,
      setPreviewOpen,
      paletteOpen,
      setPaletteOpen,
      composer,
      openComposer,
      closeComposer,
      messages,
      pushMessage,
      updateMessage,
      clearMessages,
      notifications,
      notify,
      dismissNotification,
      clearNotifications,
      labelIndex,
      setLabelIndex,
      workspaceEmails,
      setWorkspaceEmails,
    }),
    [
      activeFolder,
      selectedId,
      search,
      sidebarOpen,
      chatOpen,
      previewOpen,
      paletteOpen,
      composer,
      messages,
      notifications,
      labelIndex,
      workspaceEmails,
      pushMessage,
      updateMessage,
      clearMessages,
      notify,
      dismissNotification,
      clearNotifications,
      openComposer,
      closeComposer,
      setLabelIndex,
      setWorkspaceEmails,
    ],
  );

  return <MailUIContext.Provider value={value}>{children}</MailUIContext.Provider>;
}

export function useMailUI(): MailUIContextValue {
  const ctx = useContext(MailUIContext);
  if (!ctx) throw new Error("useMailUI must be used within MailUIProvider");
  return ctx;
}