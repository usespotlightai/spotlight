import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import type { SearchCandidate } from '@/lib/search';

const LINK = 'text-foreground underline-offset-2 hover:underline';

type CandidateReplayLinksProps = {
  at: ReplayedStation;
  candidate: SearchCandidate;
};

export function CandidateReplayLinks({
  at,
  candidate,
}: CandidateReplayLinksProps) {
  return (
    <p className="flex flex-wrap gap-x-3 text-xs">
      <TrailLink to={replayPath(at, candidate.replayId)} className={LINK}>
        {candidate.seed ? 'Its replay of the set' : 'Its replay'}
      </TrailLink>
      {candidate.heldOutReplayId && (
        <TrailLink
          to={replayPath(at, candidate.heldOutReplayId)}
          className={LINK}
        >
          Its held-out replay
        </TrailLink>
      )}
    </p>
  );
}
