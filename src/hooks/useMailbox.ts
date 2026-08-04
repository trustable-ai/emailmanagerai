import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadFolder, loadFolderCounts, loadThread } from "@/services/gmail/gmailSync";
import type { Email, Folder } from "@/lib/types";
import { GauthError } from "@/services/gmail/gmailClient";
import type { LabelIndex } from "@/services/gmail/gmailMapper";

export const MAILBOX_KEY = (folder: Folder, token: string) =>
  ["mailbox", folder, token] as const;
const COUNTS_KEY = (token: string) => ["counts", token] as const;
const THREAD_KEY = (threadId: string, token: string) =>
  ["thread", threadId, token] as const;

export function useMailbox(folder: Folder, token: string | null) {
  return useQuery({
    queryKey: MAILBOX_KEY(folder, token || ""),
    queryFn: () => loadFolder(token!, folder),
    enabled: !!token,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useMailCounts(token: string | null) {
  return useQuery({
    queryKey: COUNTS_KEY(token || ""),
    queryFn: () => loadFolderCounts(token!),
    enabled: !!token,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useThread(threadId: string | null, labelIndex: LabelIndex | null, token: string | null) {
  return useQuery({
    queryKey: THREAD_KEY(threadId || "", token || ""),
    queryFn: () => loadThread(token!, threadId!, labelIndex!),
    enabled: !!token && !!threadId && !!labelIndex,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useRefreshMail(token: string | null) {
  const qc = useQueryClient();
  return () => {
    if (!token) return;
    qc.invalidateQueries({ queryKey: ["mailbox"] });
    qc.invalidateQueries({ queryKey: ["counts"] });
    qc.invalidateQueries({ queryKey: ["thread"] });
  };
}

export function useMailAction(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fn: () => Promise<void>) => {
      if (!token) throw new Error("Not authenticated");
      await fn();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mailbox"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      qc.invalidateQueries({ queryKey: ["thread"] });
    },
  });
}

export { GauthError };
export type { Email };