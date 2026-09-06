import { Inbox } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { inboxItemPath } from '@/lib/inbox';
import { since } from '@/lib/runner';

type ReviewMarkerProps = {
  slug: string | undefined;
  conversationId: string;
  runId: string;
  at: string;
};

export function ReviewMarker({
  slug,
  conversationId,
  runId,
  at,
}: ReviewMarkerProps) {
  return (
    <li>
      <TrailLink
        to={slug ? inboxItemPath(slug, conversationId, runId) : ''}
        className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-muted-foreground text-sm outline-none transition-colors hover:bg-accent"
      >
        <Inbox className="size-4 shrink-0" aria-hidden />

        <span className="truncate">Awaiting review</span>

        <span className="ml-auto shrink-0 text-xs tabular-nums">
          {since(at)}
        </span>
      </TrailLink>
    </li>
  );
}
