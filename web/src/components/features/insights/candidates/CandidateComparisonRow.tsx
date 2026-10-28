import { BestValueMark } from '@/components/features/insights/BestValueMark';
import { GainValue } from '@/components/features/insights/candidates/GainValue';
import { RateTrack } from '@/components/features/insights/candidates/RateTrack';
import { ConfigPlan } from '@/components/features/insights/changes/ConfigPlan';
import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { ClampedCell } from '@/components/shared/nested-table/ClampedCell';
import { ExpandingRow } from '@/components/shared/nested-table/ExpandingRow';
import { ExpandToggle } from '@/components/shared/nested-table/ExpandToggle';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCount } from '@/lib/insights';
import {
  changeLinkOf,
  costBasisNote,
  formatOrigin,
  heldOutBrief,
  type SetCandidate,
} from '@/lib/insights-candidates';
import { formatPercent } from '@/lib/judge';
import { COMPACT_PILL, pillClass } from '@/lib/pill';
import type { ReplayedStation } from '@/lib/replay';
import type { GainSignificanceCode } from '@/lib/replay-words';
import { formatCostPerRun } from '@/lib/search';
import { configChangesOf } from '@/lib/station-config';
import { cn } from '@/lib/utils';

const INKS: Record<GainSignificanceCode, string> = {
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
  const { shown } = candidate;
  const changes = configChangesOf(candidate.changes);
  const link = changeLinkOf(at, candidate);
  const cost = formatCostPerRun(shown.costPerRun, candidate.currency);
  const costNote = costBasisNote(candidate);
  return (
    <ExpandingRow
      slot="replayed-candidate"
      className={cn(OUTER_GUIDE, OUTER_DIVIDER)}
    >
      {(expansion) => (
        <>
          <div
            className={cn(
              'col-span-full flex min-w-0 flex-col gap-0.5 @4xl:col-span-1',
              OUTER_INDENT,
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
                    className={cn(COMPACT_PILL, 'shrink-0')}
                  />
                )}
            </div>
          </div>

          <ClampedCell expansion={expansion}>
            {changes.length > 0 && <ConfigPlan changes={changes} />}
          </ClampedCell>

          <NestedCell heading="Source" numeric={false}>
            <span className="whitespace-nowrap">{formatOrigin(candidate)}</span>
          </NestedCell>

          <div className="col-span-full min-w-0 @4xl:col-span-1">
            <RateTrack
              rate={shown.successRate}
              interval={shown.interval}
              live={shown.liveSuccessRate}
              ink={
                candidate.gainOverLive
                  ? INKS[candidate.gainOverLive.significance]
                  : undefined
              }
            />
          </div>

          <NestedCell heading="Candidate" strong>
            {formatPercent(shown.successRate)}
          </NestedCell>
          <NestedCell heading="Live">
            {formatPercent(shown.liveSuccessRate)}
          </NestedCell>
          <NestedCell heading="Against live" numeric={false}>
            <GainValue gain={candidate.gainOverLive} />
          </NestedCell>
          <NestedCell heading="Cost per run" strong>
            {costNote ? (
              <Tooltip>
                <TooltipTrigger
                  render={<button type="button" className="outline-none" />}
                >
                  {cost}
                </TooltipTrigger>
                <TooltipContent className="text-xs">{costNote}</TooltipContent>
              </Tooltip>
            ) : (
              cost
            )}
          </NestedCell>
          <NestedCell heading="Live cost">
            {shown.liveCostPerRun === null
              ? '–'
              : formatCostPerRun(shown.liveCostPerRun, candidate.currency)}
          </NestedCell>
          {heldOut && (
            <NestedCell heading="Held out">
              {heldOutBrief(candidate)}
            </NestedCell>
          )}
          <NestedCell heading="Runs">{formatCount(shown.runs)}</NestedCell>

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
