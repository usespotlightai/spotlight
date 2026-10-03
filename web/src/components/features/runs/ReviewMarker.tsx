import { Inbox } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { inboxItemPath } from '@/lib/inbox';
import type { Review } from '@/lib/run';
import { since } from '@/lib/runner';
import { cn } from '@/lib/utils';

type ReviewMarkerProps = {
  slug: string | undefined;
  review: Review;
  runId: string;
  at: string;
};

export function ReviewMarker({ slug, review, runId, at }: ReviewMarkerProps) {
  return (
    <li>
      <TrailLink
        to={slug ? inboxItemPath(slug, review.conversationId, runId) : ''}
        className={cn(
          'flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm outline-none transition-colors hover:bg-accent',
          review.state === 'owed'
            ? 'text-muted-foreground'
            : 'text-faint opacity-70',
        )}
      >
        <Inbox className="size-4 shrink-0" aria-hidden />

        <span className="truncate">
          {review.state === 'owed' ? 'Waiting for you' : 'Answered'}
        </span>

        <span className="ml-auto shrink-0 text-xs tabular-nums">
          {since(at)}
        </span>
      </TrailLink>
    </li>
  );
}
