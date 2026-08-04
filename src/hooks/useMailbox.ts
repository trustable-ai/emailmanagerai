import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchMailbox, performAction, type ActionPayload } from "@/services/api/client";
import type { MailboxSnapshot } from "@/lib/types";

export const MAILBOX_KEY = ["mailbox"] as const;

export function useMailbox() {
  return useQuery<MailboxSnapshot>({
    queryKey: MAILBOX_KEY,
    queryFn: fetchMailbox,
    staleTime: 1000 * 10,
    retry: 1,
  });
}

export function useMailAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActionPayload) => performAction(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MAILBOX_KEY });
    },
  });
}

/** Imperatively refresh the mailbox (e.g. after an AI turn). */
export function useRefreshMailbox() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: MAILBOX_KEY });
}