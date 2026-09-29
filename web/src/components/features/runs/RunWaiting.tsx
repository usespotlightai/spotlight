import { CirclePause } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { inboxItemPath, inboxPath } from '@/lib/inbox';
import { type Run, standing } from '@/lib/run';
import { since } from '@/lib/runner';

type RunWaitingProps = {
  slug: string;
  run: Run;
  deciding: boolean;
};

export function RunWaiting({ slug, run, deciding }: RunWaitingProps) {
  const parked = run.state === 'parked';

  return (
    <div
      data-slot="run-waiting"
      className="flex items-center gap-1.5 px-1 pt-3 pb-0.5 text-muted-foreground text-xs leading-6"
    >
      <span className="flex size-6 shrink-0 items-center justify-center">
        <CirclePause className="size-4" aria-hidden />
      </span>

      <span className="font-medium text-foreground">{standing(run)}</span>

      <span className="truncate">
        {parked
          ? '· Set aside; it picks up where it left off once you answer'
          : '· It carries on once you answer'}
      </span>

      <TrailLink
        to={
          run.review
            ? inboxItemPath(slug, run.review.conversationId, run.id)
            : inboxPath(slug)
        }
        className="ml-auto shrink-0 underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
      >
        {deciding ? 'Approve or deny in the inbox' : 'Answer in the inbox'}
      </TrailLink>

      <span className="shrink-0 tabular-nums">{since(run.updatedAt)}</span>
    </div>
  );
}
