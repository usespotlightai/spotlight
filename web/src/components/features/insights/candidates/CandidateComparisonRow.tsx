import { BestValueMark } from '@/components/features/insights/BestValueMark';
import { GainSaid } from '@/components/features/insights/candidates/GainSaid';
import { RateTrack } from '@/components/features/insights/candidates/RateTrack';
import { ConfigPlan } from '@/components/features/insights/changes/ConfigPlan';
import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { ClampedCell } from '@/components/shared/nested-table/ClampedCell';
import { ExpandingRow } from '@/components/shared/nested-table/ExpandingRow';
import { ExpandToggle } from '@/components/shared/nested-table/ExpandToggle';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  INNER_DIVIDER,
  INNER_GUIDE,
  INNER_INDENT,
  OUTER_GUIDE,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { countShown } from '@/lib/insights';
import {
  changeLinkOf,
  comparedCosts,
  comparedRates,
  heldOutBrief,
  originShown,
  type SetCandidate,
} from '@/lib/insights-candidates';
import { percentShown } from '@/lib/judge';
import { pillClass } from '@/lib/pill';
import type { ReplayedStation } from '@/lib/replay';
import type { GainVerdictCode } from '@/lib/replay-words';
import { costPerRunShown } from '@/lib/search';
import { configChangesOf } from '@/lib/station-config';
import { cn } from '@/lib/utils';

const INKS: Record<GainVerdictCode, string> = {
  better: 'var(--chart-success)',
  worse: 'var(--destructive)',
  'within-noise': 'var(--chart-axis)',
};

type CandidateComparisonRowProps = {
  at: ReplayedStation;
  candidate: SetCandidate;
  heldOut: boolean;
};

export function CandidateComparisonRow({
  at,
  candidate,
  heldOut,
}: CandidateComparisonRowProps) {
  const rates = comparedRates(candidate);
  const costs = comparedCosts(candidate);
  const changes = configChangesOf(candidate.changes);
  const link = changeLinkOf(at, candidate);
  return (
    <ExpandingRow
      slot="replayed-candidate"
      className={cn(OUTER_GUIDE, INNER_GUIDE, INNER_DIVIDER)}
    >
      {(expansion) => (
        <>
          <div
            className={cn(
              'col-span-full flex min-w-0 flex-col gap-0.5 @4xl:col-span-1',
              INNER_INDENT,
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <ExpandToggle expansion={expansion}>
                {candidate.name}
              </ExpandToggle>
              {candidate.onFrontier && <BestValueMark />}
              {candidate.replayState &&
                candidate.replayState !== 'finished' && (
                  <ReplayStatePill
                    state={candidate.replayState}
                    className="shrink-0 gap-1 py-0 pr-1.5 pl-1.5 text-[0.7rem]"
                  />
                )}
            </div>
          </div>

          <ClampedCell expansion={expansion}>
            {changes.length > 0 && <ConfigPlan changes={changes} />}
          </ClampedCell>

          <NestedCell heading="Source" numeric={false}>
            <span className="whitespace-nowrap">{originShown(candidate)}</span>
          </NestedCell>

          <div className="col-span-full min-w-0 @4xl:col-span-1">
            <RateTrack
              rate={rates.own}
              interval={rates.interval}
              live={rates.live}
              ink={
                candidate.againstLive
                  ? INKS[candidate.againstLive.verdict]
                  : undefined
              }
            />
          </div>

          <NestedCell heading="Candidate" strong>
            {percentShown(rates.own)}
          </NestedCell>
          <NestedCell heading="Live">{percentShown(rates.live)}</NestedCell>
          <NestedCell heading="Against live" numeric={false}>
            <GainSaid gain={candidate.againstLive} />
          </NestedCell>
          <NestedCell heading="Cost per run" strong>
            {costPerRunShown(costs.own, candidate.currency)}
          </NestedCell>
          <NestedCell heading="Live cost">
            {costs.live === null
              ? '–'
              : costPerRunShown(costs.live, candidate.currency)}
          </NestedCell>
          {heldOut && (
            <NestedCell heading="Held out">
              {heldOutBrief(candidate)}
            </NestedCell>
          )}
          <NestedCell heading="Runs">{countShown(rates.runs)}</NestedCell>

          {link.external ? (
            <a
              href={link.to}
              target="_blank"
              rel="noreferrer"
              className={pillClass(
                'outline',
                'justify-self-start whitespace-nowrap @4xl:justify-self-end',
              )}
            >
              Changes
            </a>
          ) : (
            <TrailLink
              to={link.to}
              className={pillClass(
                'outline',
                'justify-self-start whitespace-nowrap @4xl:justify-self-end',
              )}
            >
              Changes
            </TrailLink>
          )}
        </>
      )}
    </ExpandingRow>
  );
}
