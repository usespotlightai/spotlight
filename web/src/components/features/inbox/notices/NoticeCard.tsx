import { PillLink } from '@/components/shared/PillLink';
import {
  type InboxNotice,
  NOTICE_POINTS_LABEL,
  noticeLinkPath,
  openedAt,
} from '@/lib/inbox';

type NoticeCardProps = {
  slug: string;
  notice: InboxNotice;
};

export function NoticeCard({ slug, notice }: NoticeCardProps) {
  return (
    <article
      data-slot="notice"
      aria-labelledby="notice-headline"
      className="flex flex-col gap-5"
    >
      <header className="flex flex-col gap-3">
        <p className="text-center text-muted-foreground text-xs">
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
        <PillLink variant="default" to={noticeLinkPath(slug, notice)}>
          {notice.linkLabel}
        </PillLink>
      </div>
    </article>
  );
}
