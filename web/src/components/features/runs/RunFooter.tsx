import type { ReactElement } from 'react';

import { ClosedTaskComposer } from '@/components/features/runs/ClosedTaskComposer';
import { MovedOnFooter } from '@/components/features/runs/MovedOnFooter';
import {
  RunComposer,
  WRITE_A_MESSAGE,
} from '@/components/features/runs/RunComposer';
import { RunNotStartedNotice } from '@/components/features/runs/RunNotStartedNotice';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { messageRefusal, stoppable, type TeamRun } from '@/lib/run';
import type { LatestRun, RunNotes } from '@/lib/run-notes';

type RunFooterProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  latest: LatestRun;
  conversation: RunNotes | undefined;
  onSent?: () => void;
};

export function RunFooter({
  slug,
  teamId,
  run,
  latest,
  conversation,
  onSent,
}: RunFooterProps): ReactElement {
  const { station: current, task } = useTaskStation(
    teamId,
    conversation?.taskId,
  );
  const closed = (
    station: string,
    because: string,
    stopRunId: string | null = null,
  ) => (
    <ClosedTaskComposer
      slug={slug}
      teamId={teamId}
      taskId={conversation?.taskId}
      station={station}
      label={`Message ${station}`}
      placeholder={WRITE_A_MESSAGE}
      because={because}
      stopRunId={stopRunId}
    />
  );

  if (current && task?.runNotStarted) {
    const refusedHere = messageRefusal(task.yourMessage);

    return (
      <>
        <RunNotStartedNotice
          teamId={teamId}
          taskId={task.id}
          station={current.name}
          harness={task.runNotStarted.harness}
        />
        {refusedHere !== null && refusedHere !== '' ? (
          closed(current.name, refusedHere)
        ) : (
          <RunComposer
            slug={slug}
            teamId={teamId}
            runId={null}
            taskId={task.id}
            station={current.name}
            stoppable={false}
            yourMessage={task.yourMessage}
            onSent={onSent}
          />
        )}
      </>
    );
  }

  if (current && latest.yourMessage === 'moved-on') {
    return (
      <MovedOnFooter
        slug={slug}
        teamId={teamId}
        taskId={conversation?.taskId}
        current={current}
        station={run.station?.name ?? 'the agent'}
        onSent={onSent}
      />
    );
  }

  const refused = messageRefusal(latest.yourMessage);

  if (refused !== null && refused !== '') {
    return closed(
      run.station?.name ?? 'the agent',
      refused,
      stoppable(latest) ? latest.id : null,
    );
  }

  return (
    <RunComposer
      slug={slug}
      teamId={teamId}
      runId={latest.id}
      taskId={conversation?.taskId}
      station={run.station?.name ?? 'the agent'}
      stoppable={stoppable(latest)}
      yourMessage={latest.yourMessage}
      onSent={onSent}
    />
  );
}
