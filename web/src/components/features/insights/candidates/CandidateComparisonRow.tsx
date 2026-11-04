import { BestValueMark } from '@/components/features/insights/BestValueMark';
import { GainTrack } from '@/components/features/insights/candidates/GainTrack';
import { ReplayStateIcon } from '@/components/features/insights/candidates/ReplayStateIcon';
import { ConfigPlan } from '@/components/features/insights/changes/ConfigPlan';
import { ExternalPillLink } from '@/components/shared/ExternalPillLink';
import { ClampedCell } from '@/components/shared/nested-table/ClampedCell';
import { ExpandingRow } from '@/components/shared/nested-table/ExpandingRow';
import { ExpandToggle } from '@/components/shared/nested-table/ExpandToggle';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCount } from '@/lib/insights';
import {
  changeLinkOf,
  costBasisNote,
  formatCostPerRun,
  formatSource,
  heldOutBrief,
  type SetCandidate,
} from '@/lib/insights-candidates';
import { formatPercent } from '@/lib/judge';
import { configChangesOf } from '@/lib/station-config';
import { cn } from '@/lib/utils';

type CandidateComparisonRowProps = {
  candidate: SetCandidate;
  heldOut: boolean;
};

export function CandidateComparisonRow({
  candidate,
  heldOut,
}: CandidateComparisonRowProps) {
  const { shown } = candidate;
  const changes = configChangesOf(candidate.changes);
  const link = changeLinkOf(candidate);
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
              'col-span-full flex min-w-0 flex-col gap-0.5 @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1',
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
                  <ReplayStateIcon state={candidate.replayState} />
                )}
            </div>
          </div>

          <ClampedCell expansion={expansion}>
            {changes.length > 0 && <ConfigPlan changes={changes} />}
          </ClampedCell>

          <NestedCell heading="Source" numeric={false}>
            <span className="whitespace-nowrap">
              {formatSource('searched')}
            </span>
          </NestedCell>

          <NestedCell heading="Candidate" strong>
            {formatPercent(shown.successRate)}
          </NestedCell>
          <NestedCell heading="Live">
            {formatPercent(shown.liveSuccessRate)}
          </NestedCell>
          <div className="col-span-full grid h-5 min-w-0 items-center self-start @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1">
            <GainTrack gain={candidate.gainOverLive} />
          </div>
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

          {link ? (
            <ExternalPillLink
              href={link}
              className="-my-0.5 justify-self-start whitespace-nowrap @4xl:justify-self-end @lg:group-data-compact/nested:justify-self-end"
            >
              Pull request
            </ExternalPillLink>
          ) : (
            <span className="hidden @4xl:block @lg:group-data-compact/nested:block" />
          )}
        </>
      )}
    </ExpandingRow>
  );
}
