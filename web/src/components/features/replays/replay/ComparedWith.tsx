import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  counterpartShown,
  type ReplayDetail,
  type ReplayedStation,
  replayPath,
} from '@/lib/replay';
import { COMPARED_WITH } from '@/lib/replay-words';

type ComparedWithProps = {
  at: ReplayedStation;
  replay: ReplayDetail;
};

export function ComparedWith({ at, replay }: ComparedWithProps) {
  if (!replay.comparedWithReplayId) {
    return null;
  }

  return (
    <p data-slot="compared-with" className="text-muted-foreground text-xs">
      {COMPARED_WITH}{' '}
      <TrailLink
        to={replayPath(at, replay.comparedWithReplayId)}
        className="text-foreground underline-offset-2 hover:underline"
      >
        {counterpartShown(
          replay.comparedWithReplayId,
          replay.candidate,
          replay.baselineReplayId,
        )}
      </TrailLink>
      .
    </p>
  );
}
