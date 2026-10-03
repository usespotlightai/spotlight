import { ReplayedFigure } from '@/components/features/insights/candidates/ReplayedFigure';
import {
  heldOutShown,
  replaySuccessShown,
  type SetCandidate,
  tasksShown,
} from '@/lib/insights-candidates';
import { costPerRunShown } from '@/lib/search';

type ReplayedCandidateFiguresProps = {
  candidate: SetCandidate;
};

export function ReplayedCandidateFigures({
  candidate,
}: ReplayedCandidateFiguresProps) {
  const heldOut = heldOutShown(candidate);

  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
      <ReplayedFigure label="Replayed">
        {tasksShown(candidate.tasks, candidate.runs)}
      </ReplayedFigure>
      <ReplayedFigure
        label={
          candidate.kind === 'searched' ? 'Search score' : 'Replay success'
        }
      >
        {replaySuccessShown(candidate.successRate, candidate.scored)}
      </ReplayedFigure>
      {heldOut && (
        <ReplayedFigure label="Held out" slot="held-out">
          {heldOut}
        </ReplayedFigure>
      )}
      <ReplayedFigure label="Cost per run">
        {costPerRunShown(candidate.costPerRun, candidate.currency)}
      </ReplayedFigure>
    </dl>
  );
}
