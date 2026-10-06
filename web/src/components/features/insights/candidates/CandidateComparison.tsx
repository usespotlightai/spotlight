import { CandidateComparisonRow } from '@/components/features/insights/candidates/CandidateComparisonRow';
import { ComparisonCell } from '@/components/features/insights/candidates/ComparisonCell';
import { ComparisonHeadings } from '@/components/features/insights/candidates/ComparisonHeadings';
import { RateTrack } from '@/components/features/insights/candidates/RateTrack';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { countShown } from '@/lib/insights';
import {
  type CandidatesSet,
  rankedCandidates,
} from '@/lib/insights-candidates';
import { percentShown } from '@/lib/judge';
import { pillClass } from '@/lib/pill';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import { costPerRunShown } from '@/lib/search';
import { cn } from '@/lib/utils';

type CandidateComparisonProps = {
  at: ReplayedStation;
  set: CandidatesSet;
};

export function CandidateComparison({ at, set }: CandidateComparisonProps) {
  const baseline = set.baseline;
  const heldOut = set.candidates.some((each) => each.heldOut !== null);

  return (
    <div className="@container">
      <div
        className={cn(
          'grid gap-x-6',
          heldOut
            ? '@4xl:grid-cols-[minmax(12rem,20rem)_max-content_minmax(8rem,1fr)_repeat(2,max-content)_max-content_repeat(4,max-content)_max-content]'
            : '@4xl:grid-cols-[minmax(12rem,20rem)_max-content_minmax(8rem,1fr)_repeat(2,max-content)_max-content_repeat(3,max-content)_max-content]',
        )}
      >
        <ComparisonHeadings heldOut={heldOut} />

        <ul
          aria-label={`Candidates replayed over ${set.name}`}
          className="col-span-full grid grid-cols-subgrid divide-y divide-border"
        >
          {rankedCandidates(set).map((candidate) => (
            <CandidateComparisonRow
              key={candidate.candidateId}
              at={at}
              candidate={candidate}
              heldOut={heldOut}
            />
          ))}

          {baseline && (
            <li
              data-slot="replayed-baseline"
              className="col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2.5 last:pb-1 @4xl:grid-cols-subgrid"
            >
              <div className="col-span-full flex min-w-0 flex-col gap-0.5 @4xl:col-span-1">
                <span className="font-medium text-foreground text-xs">
                  Live config
                </span>
                <span className="text-muted-foreground text-xs">
                  Replayed over the whole set
                </span>
              </div>
              <ComparisonCell heading="Source" numeric={false}>
                Live
              </ComparisonCell>
              <div className="col-span-full min-w-0 @4xl:col-span-1">
                <RateTrack rate={null} live={baseline.successRate} />
              </div>
              <ComparisonCell heading="Candidate">–</ComparisonCell>
              <ComparisonCell heading="Live" strong>
                {percentShown(baseline.successRate)}
              </ComparisonCell>
              <span className="hidden @4xl:block" />
              <ComparisonCell heading="Cost per run">–</ComparisonCell>
              <ComparisonCell heading="Live cost" strong>
                {costPerRunShown(baseline.costPerRun, baseline.currency)}
              </ComparisonCell>
              {heldOut && <span className="hidden @4xl:block" />}
              <ComparisonCell heading="Runs">
                {countShown(baseline.scored)}
              </ComparisonCell>
              <TrailLink
                to={replayPath(at, baseline.replayId)}
                className={pillClass(
                  'outline',
                  'justify-self-start whitespace-nowrap @4xl:justify-self-end',
                )}
              >
                View replay
              </TrailLink>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
