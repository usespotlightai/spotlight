import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type EntryPair, passesDisagree } from '@/lib/replay';
import {
  CLOSER_TO_ACCEPTED,
  formatCitedHunks,
  formatPair,
  formatPass,
  formatUnpaired,
  OTHER_CHANGE,
  OTHER_RUN,
  PAIR_REQUESTED,
  PASSES_DISAGREED,
  PASSES_LABEL,
} from '@/lib/replay-words';

type EntryPairPassesProps = {
  pair: EntryPair;
  otherRunTo: string;
};

export function EntryPairPasses({ pair, otherRunTo }: EntryPairPassesProps) {
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
          to={otherRunTo}
          className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {OTHER_RUN}
        </TrailLink>
      </p>

      {pair.state === 'requested' && (
        <p className="text-muted-foreground">{PAIR_REQUESTED}</p>
      )}
      {pair.state === 'unpaired' && (
        <p className="text-muted-foreground">{formatUnpaired(pair.unpaired)}</p>
      )}
      {passesDisagree(pair) && (
        <p data-slot="passes-disagreed" className="text-muted-foreground">
          {PASSES_DISAGREED}
        </p>
      )}

      {pair.passes.length > 0 && (
        <ol aria-label={PASSES_LABEL} className="flex flex-col gap-1.5">
          {pair.passes.map((pass) => (
            <li
              key={String(pass.ownShownFirst)}
              data-slot="pair-pass"
              className="flex flex-col gap-0.5"
            >
              <p>
                <span className="text-muted-foreground">
                  {formatPass(pass.ownShownFirst)}:
                </span>{' '}
                <span className="text-foreground">
                  {formatPair(pass.outcome, OTHER_CHANGE)}
                </span>
              </p>
              <ul className="flex flex-col gap-0.5 pl-3">
                {pass.reasons.map((reason, at) => {
                  const cites = formatCitedHunks(
                    reason.ownHunks.length,
                    reason.theirHunks.length,
                  );

                  return (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: the position of a reason identifies it, because the reasons of a pass do not change after they are recorded
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
