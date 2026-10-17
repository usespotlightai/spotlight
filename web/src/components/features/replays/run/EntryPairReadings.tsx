import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type EntryPair, readingsDisagree } from '@/lib/replay';
import {
  CLOSER_TO_ACCEPTED,
  formatCitedHunks,
  formatPair,
  formatReading,
  formatUnpaired,
  OTHER_CHANGE,
  OTHER_RUN,
  PAIR_ASKED,
  READINGS_DISAGREED,
  READINGS_LABEL,
} from '@/lib/replay-words';

type EntryPairReadingsProps = {
  pair: EntryPair;
  againstTo: string;
};

export function EntryPairReadings({ pair, againstTo }: EntryPairReadingsProps) {
  return (
    <section
      data-slot="entry-pair"
      aria-label={CLOSER_TO_ACCEPTED}
      className="flex flex-col gap-1.5"
    >
      <p className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-muted-foreground">{CLOSER_TO_ACCEPTED}:</span>
        {pair.state === 'judged' && (
          <span
            data-slot="pair-outcome"
            className="font-medium text-foreground"
          >
            {formatPair(pair.outcome, OTHER_CHANGE)}
          </span>
        )}
        <TrailLink
          to={againstTo}
          className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {OTHER_RUN}
        </TrailLink>
      </p>

      {pair.state === 'asked' && (
        <p className="text-muted-foreground">{PAIR_ASKED}</p>
      )}
      {pair.state === 'unpaired' && (
        <p className="text-muted-foreground">{formatUnpaired(pair.unpaired)}</p>
      )}
      {readingsDisagree(pair) && (
        <p data-slot="readings-disagreed" className="text-muted-foreground">
          {READINGS_DISAGREED}
        </p>
      )}

      {pair.readings.length > 0 && (
        <ol aria-label={READINGS_LABEL} className="flex flex-col gap-1.5">
          {pair.readings.map((reading) => (
            <li
              key={String(reading.ownShownFirst)}
              data-slot="pair-reading"
              className="flex flex-col gap-0.5"
            >
              <p>
                <span className="text-muted-foreground">
                  {formatReading(reading.ownShownFirst)}:
                </span>{' '}
                <span className="text-foreground">
                  {formatPair(reading.outcome, OTHER_CHANGE)}
                </span>
              </p>
              <ul className="flex flex-col gap-0.5 pl-3">
                {reading.reasons.map((reason, at) => {
                  const cites = formatCitedHunks(
                    reason.ownHunks.length,
                    reason.theirHunks.length,
                  );

                  return (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: the position of a reason identifies it, because the reasons of a reading do not change after they are recorded
                      key={at}
                      data-slot="pair-reason"
                      className="text-foreground leading-5"
                    >
                      {reason.text}
                      {cites && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {cites}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
