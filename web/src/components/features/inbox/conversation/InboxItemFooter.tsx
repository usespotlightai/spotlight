import { Link } from 'react-router';
import { InboxComposer } from '@/components/features/inbox/conversation/InboxComposer';
import { type InboxItem, inboxRunPath } from '@/lib/inbox';
import type { Progress } from '@/lib/run';
import { taskPath } from '@/lib/task';

type InboxItemFooterProps = {
  slug: string;
  item: InboxItem;
  progress: Progress | null;
};

export function InboxItemFooter({
  slug,
  item,
  progress,
}: InboxItemFooterProps) {
  if (!item.resolved) {
    return (
      <InboxComposer
        slug={slug}
        itemId={item.id}
        taskId={item.taskId}
        station={item.station}
        teamId={item.teamId}
        runId={item.runId}
        running={progress === 'in-progress'}
      />
    );
  }

  const { currentStation } = item;

  return (
    <p className="pb-5 text-center text-muted-foreground text-xs">
      {currentStation.name === item.station ? (
        'The conversation is closed here. Nothing is left to answer.'
      ) : (
        <>
          The task moved on to{' '}
          <Link
            to={
              currentStation.latestRunId
                ? inboxRunPath(slug, item.teamId, currentStation.latestRunId)
                : taskPath(slug, item.teamId, item.taskId)
            }
            className="font-medium text-foreground hover:underline"
          >
            {currentStation.name}
          </Link>
          . Nothing is left to answer.
        </>
      )}
    </p>
  );
}
