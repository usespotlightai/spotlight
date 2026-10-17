import { HeldOutScore } from '@/components/features/replays/HeldOutScore';
import { ScoredRate } from '@/components/features/replays/ScoredRate';
import {
  formatCostPerRun,
  formatHeldOut,
  type SearchCandidate,
} from '@/lib/search';

type CandidateScoresProps = {
  candidate: SearchCandidate;
  currency: string;
};

export function CandidateScores({ candidate, currency }: CandidateScoresProps) {
  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
      <div className="flex gap-1">
        <dt>Searched</dt>
        <dd className="text-foreground tabular-nums">
          <ScoredRate
            rate={candidate.searchScore}
            interval={candidate.searchInterval}
            scored={candidate.searchScored}
          />
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>Held out</dt>
        <dd className="text-foreground tabular-nums">
          <HeldOutScore
            rate={candidate.heldOutScore}
            interval={candidate.heldOutInterval}
            unscored={formatHeldOut(candidate)}
          />
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>Cost per run</dt>
        <dd className="text-foreground tabular-nums">
          {formatCostPerRun(candidate.costPerRun, currency)}
        </dd>
      </div>
    </dl>
  );
}
