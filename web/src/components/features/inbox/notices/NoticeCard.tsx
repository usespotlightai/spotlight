import { Lightbulb } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  type InboxNotice,
  NOTICE_DISMISS,
  NOTICE_DISMISS_FAILED,
  NOTICE_DISMISSED,
  NOTICE_POINTS_LABEL,
  noticeLinkPath,
  openedAt,
} from '@/lib/inbox';
import { cn } from '@/lib/utils';

type NoticeCardProps = {
  slug: string;
  notice: InboxNotice;
  dismissing: boolean;
  dismissFailed: boolean;
  onDismiss: () => void;
};

export function NoticeCard({
  slug,
  notice,
  dismissing,
  dismissFailed,
  onDismiss,
}: NoticeCardProps) {
  return (
    <article
      data-slot="notice"
      aria-labelledby="notice-headline"
      className="flex flex-col gap-5"
    >
      <header className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Lightbulb aria-hidden className="size-3.5" />
          <time dateTime={notice.askedAt}>{openedAt(notice.askedAt)}</time>
        </p>
        <h1
          id="notice-headline"
          className="font-medium text-base text-foreground"
        >
          {notice.headline}
        </h1>
      </header>

      {notice.points.length > 0 && (
        <section
          aria-labelledby="notice-points"
          className="flex flex-col gap-2"
        >
          <h2
            id="notice-points"
            className="font-medium text-muted-foreground text-xs"
          >
            {NOTICE_POINTS_LABEL}
          </h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-foreground text-sm leading-6">
            {notice.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <TrailLink
          to={noticeLinkPath(slug, notice)}
          className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
        >
          {notice.linkLabel}
        </TrailLink>

        {notice.resolved ? (
          <p className="text-muted-foreground text-xs">{NOTICE_DISMISSED}</p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-card shadow-none"
            disabled={dismissing}
            onClick={onDismiss}
          >
            {NOTICE_DISMISS}
          </Button>
        )}
      </div>

      {dismissFailed && (
        <p role="alert" className="text-destructive text-xs">
          {NOTICE_DISMISS_FAILED}
        </p>
      )}
    </article>
  );
}
