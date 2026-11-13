import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { TONE_FILL } from '@/components/features/stations/activity/outcome-tones';
import { formatShare, type ShownDelta } from '@/lib/insights';
import {
  OUTCOME_NOTE,
  OUTCOMES_TITLE,
  type OutcomePart,
  outcomePartsOf,
  type StationTally,
} from '@/lib/station-insights';
import { cn } from '@/lib/utils';

type OutcomeKey = OutcomePart['key'] | 'merged';

type OutcomesTileProps = {
  tally: Pick<
    StationTally,
    'runs' | 'resolutions' | 'resolutionShares' | 'merged'
  >;
  changes?: Partial<Record<OutcomeKey, ShownDelta | null>>;
};

const runsOf = (count: number): string =>
  `${count} ${count === 1 ? 'run' : 'runs'}`;

const tasksOf = (count: number): string =>
  `${count} ${count === 1 ? 'task' : 'tasks'}`;

export function OutcomesTile({ tally, changes }: OutcomesTileProps) {
  const parts = outcomePartsOf(tally);
  const [accepted, ...rest] = parts;
  const keyed = rest.filter((part) => part.key !== 'other' && part.count > 0);
  const withChange = (shown: string, key: OutcomeKey) => {
    const change = changes?.[key]?.shown;

    return change ? `${shown}, ${change}` : shown;
  };

  return (
    <InsightsTile
      label={OUTCOMES_TITLE}
      value={`${formatShare(accepted?.share ?? null)} accepted`}
      tooltip={{
        title: OUTCOMES_TITLE,
        rows: [
          ...parts.map((part): [string, string] => [
            part.label,
            withChange(`${part.count} of ${runsOf(tally.runs)}`, part.key),
          ]),
          ['Merged', withChange(tasksOf(tally.merged), 'merged')],
        ],
        body: OUTCOME_NOTE,
      }}
      visual={
        <span data-slot="outcome-parts" className="flex flex-col gap-1.5">
          <span
            aria-hidden
            className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted"
          >
            {parts
              .filter((part) => part.count > 0)
              .map((part) => (
                <span
                  key={part.key}
                  className={cn('h-full', TONE_FILL[part.tone])}
                  style={{ flexGrow: part.count }}
                />
              ))}
          </span>
          {keyed.length > 0 && (
            <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-muted-foreground text-xs">
              {keyed.map((part) => (
                <span key={part.key} className="flex items-start gap-1">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-[calc((1lh-0.375rem)/2)] size-1.5 shrink-0 rounded-full',
                      TONE_FILL[part.tone],
                    )}
                  />
                  <span className="text-foreground tabular-nums">
                    {formatShare(part.share)}
                  </span>
                  {part.label.toLowerCase()}
                </span>
              ))}
            </span>
          )}
        </span>
      }
    />
  );
}
