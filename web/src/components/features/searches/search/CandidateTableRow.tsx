import { OnlyOnSeenTasksMark } from '@/components/features/searches/OnlyOnSeenTasksMark';
import { CandidatePullRequest } from '@/components/features/searches/search/CandidatePullRequest';
import { Noted } from '@/components/shared/Noted';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { formatPercent } from '@/lib/judge';
import type { RateInterval } from '@/lib/replay';
import {
  formatGain,
  formatInterval,
  formatRunsScored,
  formatState,
  NOT_SCORED_YET,
} from '@/lib/replay-words';
import {
  candidateName,
  formatCostPerRun,
  formatHeldOut,
  type SearchCandidate,
  searchCandidateAnchor,
} from '@/lib/search';
import {
  candidateGainNote,
  ON_THE_FRONTIER,
  ON_THE_FRONTIER_NOTE,
} from '@/lib/search-words';
import { cn } from '@/lib/utils';

const GAIN_TONES = {
  better: 'text-emerald-600 dark:text-emerald-400',
  worse: 'text-destructive',
  'within-noise': 'text-muted-foreground',
} as const;

function Rate({
  rate,
  interval,
  more,
}: {
  rate: number;
  interval: RateInterval | null;
  more?: string;
}) {
  const note = [interval && `Likely range: ${formatInterval(interval)}`, more]
    .filter(Boolean)
    .join(' · ');

  return note ? (
    <Noted note={note}>
      <span className="relative z-10">{formatPercent(rate)}</span>
    </Noted>
  ) : (
    formatPercent(rate)
  );
}

type CandidateTableRowProps = {
  candidate: SearchCandidate;
  currency: string;
  picked: boolean;
  onPick: () => void;
};

export function CandidateTableRow({
  candidate,
  currency,
  picked,
  onPick,
}: CandidateTableRowProps) {
  const name = candidateName(candidate);
  const gain = candidate.searchedGain;
  const unfinished =
    candidate.replayState && candidate.replayState !== 'finished'
      ? formatState(candidate.replayState)
      : null;

  return (
    <li
      id={searchCandidateAnchor(candidate.candidateId)}
      data-slot="search-candidate"
      data-picked={picked || undefined}
      className={cn(TABLE_ROW, ROW_DIVIDER, picked && 'bg-selected')}
    >
      <span className={cn(LEAD_CELL, EDGE_INDENT)}>
        <button
          type="button"
          aria-label={`Details of ${name}`}
          aria-pressed={picked}
          onClick={onPick}
          className="truncate text-left font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {name}
        </button>
        {candidate.onFrontier && (
          <Noted note={ON_THE_FRONTIER_NOTE}>
            <span
              role="img"
              aria-label={ON_THE_FRONTIER}
              data-slot="on-the-frontier"
              className="relative z-10 size-1.5 shrink-0 rounded-full bg-primary"
            />
          </Noted>
        )}
        {candidate.onlyOnSeenTasks && (
          <OnlyOnSeenTasksMark mark={candidate.onlyOnSeenTasks} />
        )}
      </span>
      <NestedCell heading="Searched" strong>
        {unfinished ? (
          <span className="font-normal text-muted-foreground">
            {unfinished}
          </span>
        ) : candidate.searchScored === 0 || candidate.searchScore === null ? (
          <span className="font-normal text-muted-foreground">
            {NOT_SCORED_YET}
          </span>
        ) : (
          <Rate
            rate={candidate.searchScore}
            interval={candidate.searchInterval}
            more={formatRunsScored(candidate.searchScored)}
          />
        )}
      </NestedCell>
      <NestedCell heading="Held out">
        {candidate.heldOutScore === null ? (
          formatHeldOut(candidate)
        ) : (
          <Rate
            rate={candidate.heldOutScore}
            interval={candidate.heldOutInterval}
          />
        )}
      </NestedCell>
      <NestedCell heading="Gain">
        {gain ? (
          <Noted note={candidateGainNote(gain, candidate.heldOutGain)}>
            <span className={cn('relative z-10', GAIN_TONES[gain.verdict])}>
              {formatGain(gain)}
            </span>
          </Noted>
        ) : (
          '–'
        )}
      </NestedCell>
      <NestedCell heading="Cost per run">
        {formatCostPerRun(candidate.costPerRun, currency)}
      </NestedCell>
      <NestedCell heading="Pull request" numeric={false}>
        <CandidatePullRequest candidate={candidate} />
      </NestedCell>
    </li>
  );
}
