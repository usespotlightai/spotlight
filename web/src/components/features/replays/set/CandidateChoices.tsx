import type { UseQueryResult } from '@tanstack/react-query';
import { CandidateChoice } from '@/components/features/replays/set/CandidateChoice';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { failed, loading } from '@/lib/query';
import { candidatesInOrder, LIVE, type ReplayCandidate } from '@/lib/replay';

type CandidateChoicesProps = {
  candidates: UseQueryResult<ReplayCandidate[]>;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
};

export function CandidateChoices({
  candidates,
  value,
  onChange,
  disabled,
}: CandidateChoicesProps) {
  const proposed = candidatesInOrder(candidates.data ?? []);

  return (
    <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
      <CandidateChoice
        value={LIVE}
        name="Live config"
        detail="The station as it is configured now"
        checked={value === LIVE}
        disabled={disabled}
        onChange={onChange}
      />

      {proposed.map((candidate) => (
        <CandidateChoice
          key={candidate.id}
          value={candidate.id}
          name={candidate.name}
          fingerprint={candidate.fingerprint}
          checked={value === candidate.id}
          disabled={disabled}
          onChange={onChange}
        />
      ))}

      {loading(candidates) && <SkeletonLine className="w-40 px-2 text-sm" />}
      {failed(candidates) && (
        <p className="px-2 text-muted-foreground text-xs">
          The station’s candidates could not be loaded; the live config can
          still be replayed.
        </p>
      )}
    </div>
  );
}
