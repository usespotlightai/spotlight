import { InboxRow } from '@/components/features/inbox/InboxRow';
import { InboxRunRow } from '@/components/features/inbox/InboxRunRow';
import { NoticeRow } from '@/components/features/inbox/NoticeRow';
import type { InboxEntry } from '@/lib/inbox';

type InboxEntryRowProps = {
  slug: string;
  entry: InboxEntry;
};

export function InboxEntryRow({ slug, entry }: InboxEntryRowProps) {
  if (entry.kind === 'run') {
    return <InboxRunRow slug={slug} run={entry} />;
  }

  return entry.kind === 'notice' ? (
    <NoticeRow slug={slug} notice={entry} />
  ) : (
    <InboxRow slug={slug} item={entry} />
  );
}
