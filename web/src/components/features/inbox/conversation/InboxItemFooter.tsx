import { InboxComposer } from '@/components/features/inbox/conversation/InboxComposer';
import { ClosedTaskComposer } from '@/components/features/runs/ClosedTaskComposer';
import { RunNotStartedNotice } from '@/components/features/runs/RunNotStartedNotice';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { answerPlaceholder, followed, type InboxItem } from '@/lib/inbox';
import type { Progress } from '@/lib/run';

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
  const { station, task } = useTaskStation(item.teamId, item.taskId);

  if (!item.resolved && !item.viewerActs) {
    return (
      <ClosedTaskComposer
        slug={slug}
        teamId={item.teamId}
        taskId={item.taskId}
        station={item.station}
        label={`Answer ${item.station}`}
        placeholder={answerPlaceholder(item.station)}
        because={
          followed(item)
            ? 'You follow this task. Its assignee answers here.'
            : 'You see this team’s tasks. People who act on them answer here.'
        }
      />
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
    <ClosedTaskComposer
      slug={slug}
      teamId={item.teamId}
      taskId={item.taskId}
      station={item.station}
      label={`Answer ${item.station}`}
      placeholder={answerPlaceholder(item.station)}
      because={
        currentStation.name === item.station
          ? 'The conversation is closed here. Nothing is left to answer.'
          : `The task moved on to ${currentStation.name}. Nothing is left to answer.`
      }
    />
  );
}
