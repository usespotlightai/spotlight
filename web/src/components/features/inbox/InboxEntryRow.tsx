import { InboxRow } from '@/components/features/inbox/InboxRow';
import { NoticeRow } from '@/components/features/inbox/NoticeRow';
import type { InboxEntry } from '@/lib/inbox';

type InboxEntryRowProps = {
  slug: string;
  entry: InboxEntry;
};

export function InboxEntryRow({ slug, entry }: InboxEntryRowProps) {
  return entry.kind === 'notice' ? (
    <NoticeRow slug={slug} notice={entry} />
  ) : (
    <InboxRow slug={slug} item={entry} />
  );
}
