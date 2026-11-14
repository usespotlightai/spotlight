import { Link } from 'react-router';

import { InboxComposer } from '@/components/features/inbox/conversation/InboxComposer';
import { Button } from '@/components/ui/button';
import { useTakeInboxItem } from '@/hooks/api/useTakeInboxItem';
import {
  followed,
  type InboxItem,
  inboxRunPath,
  WAITING_FOR_TEAM,
  waitsForTeam,
} from '@/lib/inbox';
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
  const take = useTakeInboxItem();

  if (!item.resolved && followed(item)) {
    return (
      <p className="pb-5 text-center text-muted-foreground text-xs">
        You follow this task. Its assignee answers here.
      </p>
    );
  }

  if (!item.resolved) {
    return (
      <>
        {waitsForTeam(item) && (
          <div className="flex items-center justify-between gap-2 pb-2 text-muted-foreground text-xs">
            <span>{WAITING_FOR_TEAM}. An answer assigns the task to you.</span>
            <Button
              variant="outline"
              size="xs"
              disabled={take.isPending}
              onClick={() => take.mutate({ slug, itemId: item.id })}
            >
              Take it
            </Button>
          </div>
        )}
        <InboxComposer
          slug={slug}
          itemId={item.id}
          taskId={item.taskId}
          station={item.station}
          teamId={item.teamId}
          runId={item.runId}
          running={progress === 'in-progress'}
        />
      </>
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
