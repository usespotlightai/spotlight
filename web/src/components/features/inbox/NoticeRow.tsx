import { Lightbulb } from 'lucide-react';
import { InboxRowFrame } from '@/components/features/inbox/InboxRowFrame';
import { type InboxNotice, noticePath, noticePreviewOf } from '@/lib/inbox';

type NoticeRowProps = {
  slug: string;
  notice: InboxNotice;
};

export function NoticeRow({ slug, notice }: NoticeRowProps) {
  return (
    <InboxRowFrame
      to={noticePath(slug, notice.id)}
      icon={
        <Lightbulb
          aria-hidden
          data-slot="notice-icon"
          className="size-4 shrink-0 text-muted-foreground"
        />
      }
      title={notice.headline}
      unread={notice.unread}
      at={notice.askedAt}
      preview={noticePreviewOf(notice)}
    />
  );
}
