import { CirclePause, Inbox } from 'lucide-react';
import { PillLink } from '@/components/shared/PillLink';
import { inboxItemPath, inboxPath } from '@/lib/inbox';
import { type Run, runStatus } from '@/lib/run';

type RunWaitingProps = {
  slug: string;
  run: Run;
  deciding: boolean;
};

export function RunWaiting({ slug, run, deciding }: RunWaitingProps) {
  return (
    <div
      data-slot="run-waiting"
      className="flex items-center gap-1.5 text-muted-foreground text-xs leading-6"
    >
      <CirclePause className="size-4 shrink-0" aria-hidden />

      <span className="font-medium text-foreground">{runStatus(run)}</span>

      <PillLink
        to={
          run.review
            ? inboxItemPath(slug, run.review.conversationId, run.id)
            : inboxPath(slug)
        }
        className="ml-auto"
      >
        <Inbox aria-hidden className="size-3" />
        {deciding ? 'Open in the inbox' : 'Answer in the inbox'}
      </PillLink>
    </div>
  );
}
