import { AnimatePresence } from "framer-motion";
import { Inbox } from "lucide-react";
import type { Email, Folder } from "@/lib/types";
import { useMailUI } from "@/store/MailContext";
import {
  emailsForFolder,
  FOLDER_LABELS,
  searchEmails,
  sortByDate,
} from "@/lib/mailUtils";
import { EmailListItem } from "@/components/mail/EmailListItem";
import { EmailListSkeleton, EmptyState } from "@/components/mail/Skeletons";

interface EmailListProps {
  emails: Email[];
  loading: boolean;
  error?: unknown;
}

export function EmailList({ emails, loading, error }: EmailListProps) {
  const { activeFolder, search } = useMailUI();

  let list = emailsForFolder(emails, activeFolder as Folder);
  list = searchEmails(list, search);
  list = sortByDate(list);

  const title = FOLDER_LABELS[activeFolder as Folder];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-[11px] text-muted-foreground">
            {list.length} {list.length === 1 ? "message" : "messages"}
            {search ? " · filtered" : ""}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <EmailListSkeleton />
        ) : error ? (
          <EmptyState
            title="Couldn't load mailbox"
            text="Check your connection and try again."
            icon={<Inbox className="h-8 w-8" />}
          />
        ) : list.length === 0 ? (
          <EmptyState
            title={search ? "No results" : "Nothing here yet"}
            text={search ? `No emails match “${search}”.` : "This folder is empty."}
            icon={<Inbox className="h-8 w-8" />}
          />
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {list.map((e, i) => (
                <EmailListItem key={e.id} email={e} index={i} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}