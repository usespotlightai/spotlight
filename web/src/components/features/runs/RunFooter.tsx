import { RunComposer } from '@/components/features/runs/RunComposer';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { runPath, type TeamRun, waitsOnPerson } from '@/lib/run';
import type { LatestRun, RunNotes } from '@/lib/run-notes';

type RunFooterProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  latest: LatestRun;
  conversation: RunNotes | undefined;
  deciding: boolean;
  onSent?: () => void;
};

export function RunFooter({
  slug,
  teamId,
  run,
  latest,
  conversation,
  deciding,
  onSent,
}: RunFooterProps) {
  const { station: current } = useTaskStation(teamId, conversation?.taskId);

  if (current && run.station && current.id !== run.station.id) {
    return (
      <p className="pb-5 text-center text-muted-foreground text-xs">
        The task has moved to{' '}
        {latest.id === run.id ? (
          <strong>{current.name}</strong>
        ) : (
          <TrailLink
            to={runPath(slug, teamId, latest.id)}
            className="font-semibold underline-offset-4 hover:text-foreground hover:underline"
          >
            {current.name}
          </TrailLink>
        )}
        . Messages here reach no one.
      </p>
    );
  }

  return (
    <RunComposer
      slug={slug}
      teamId={teamId}
      runId={latest.id}
      taskId={conversation?.taskId}
      station={run.station?.name ?? 'the agent'}
      stationId={run.station?.id}
      running={latest.state === 'claimed' && latest.progress !== 'stopping'}
      answering={waitsOnPerson(latest) && !deciding}
      onSent={onSent}
    />
  );
}
