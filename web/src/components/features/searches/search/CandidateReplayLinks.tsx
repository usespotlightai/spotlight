import { SectionLink } from '@/components/shared/SectionLink';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import type { SearchCandidate } from '@/lib/search';

type CandidateReplayLinksProps = {
  at: ReplayedStation;
  candidate: SearchCandidate;
};

export function CandidateReplayLinks({
  at,
  candidate,
}: CandidateReplayLinksProps) {
  return (
    <p className="flex flex-wrap gap-x-3">
      <SectionLink to={replayPath(at, candidate.replayId)}>
        {candidate.isSeed ? 'Replay of the set' : 'Replay'}
      </SectionLink>
      {candidate.heldOutReplayId && (
        <SectionLink to={replayPath(at, candidate.heldOutReplayId)}>
          Held-out replay
        </SectionLink>
      )}
    </p>
  );
}
