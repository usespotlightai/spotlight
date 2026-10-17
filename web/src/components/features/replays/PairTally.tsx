import { Noted } from '@/components/shared/Noted';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  formatPairTally,
  pairsJudged,
  pairTallyNote,
  SIDE_BY_SIDE_WITH,
  type PairTally as Tally,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type PairTallyProps = {
  tally: Tally | null;
  against: string;
  to?: string | null;
  className?: string;
};

export function PairTally({
  tally,
  against,
  to = null,
  className,
}: PairTallyProps) {
  if (!pairsJudged(tally)) {
    return null;
  }

  return (
    <span
      data-slot="pair-tally"
      className={cn('text-muted-foreground text-xs tabular-nums', className)}
    >
      {SIDE_BY_SIDE_WITH}{' '}
      {to ? (
        <TrailLink
          to={to}
          className="text-foreground underline-offset-2 hover:underline"
        >
          {against}
        </TrailLink>
      ) : (
        against
      )}
      :{' '}
      <Noted note={pairTallyNote(against)}>
        <span className="text-foreground">{formatPairTally(tally)}</span>
      </Noted>
    </span>
  );
}
