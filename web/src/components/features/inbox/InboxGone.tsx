import { PageNotice } from '@/components/shared/PageNotice';
import { GONE_FROM_INBOX } from '@/lib/inbox';

export function InboxGone() {
  return (
    <PageNotice>
      <p className="text-muted-foreground text-sm">{GONE_FROM_INBOX}</p>
    </PageNotice>
  );
}
