import { InboxComposer } from '@/components/features/inbox/conversation/InboxComposer';
import { ClosedTaskComposer } from '@/components/features/runs/ClosedTaskComposer';
import { RunNotStartedNotice } from '@/components/features/runs/RunNotStartedNotice';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { answerPlaceholder, followed, type InboxItem } from '@/lib/inbox';
import { type Progress, stoppable } from '@/lib/run';

type InboxItemFooterProps = {
  slug: string;
  item: InboxItem;
  conversationId: string;
  progress: Progress | null;
};

export function InboxItemFooter({
  slug,
  item,
  conversationId,
  progress,
}: InboxItemFooterProps) {
  const { line, station, task } = useTaskStation(item.teamId, item.taskId);
  const placeholder = answerPlaceholder(item.station, line?.stations);

  if (!item.resolved && !item.answerable && followed(item)) {
    return (
      <ClosedTaskComposer
        slug={slug}
        teamId={item.teamId}
        taskId={item.taskId}
        station={item.station}
        label={`Answer ${item.station}`}
        placeholder={placeholder}
        because="You follow this task. Its assignee answers here."
        stopRunId={stoppable({ ...item, progress }) ? item.runId : null}
      />
    );
  }

  if (!item.resolved && !item.answerable) {
    return (
      <p className="pb-5 text-center text-muted-foreground text-xs">
        {item.standing === null
          ? 'Its assignee answers here.'
          : 'You see the tasks of this team, but do not act on them.'}
      </p>
    );
  }

  if (!item.resolved) {
    return (
      <>
        {station && task?.runNotStarted ? (
          <RunNotStartedNotice
            teamId={item.teamId}
            taskId={item.taskId}
            station={station.name}
            harness={task.runNotStarted.harness}
          />
        ) : null}
        <InboxComposer
          slug={slug}
          itemId={conversationId}
          taskId={item.taskId}
          station={item.station}
          teamId={item.teamId}
          runId={item.runId}
          stoppable={stoppable({ ...item, progress })}
        />
      </>
    );
  }

  const { currentStation } = item;

  return (
    <ClosedTaskComposer
      slug={slug}
      teamId={item.teamId}
      taskId={item.taskId}
      station={item.station}
      label={`Answer ${item.station}`}
      placeholder={placeholder}
      because={
        currentStation.name === item.station
          ? 'The conversation is closed here. Nothing is left to answer.'
          : `The task moved on to ${currentStation.name}. Nothing is left to answer.`
      }
    />
  );
}
