import type { UseQueryResult } from '@tanstack/react-query';
import { CandidateChoice } from '@/components/features/replays/set/CandidateChoice';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <ScrollArea className="max-h-60" contentClassName="flex flex-col gap-1">
      <CandidateChoice
        value={LIVE}
        name="Live config"
        detail="Station as configured now"
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
          Sorry, the station’s candidates couldn’t be loaded. You can still
          replay the live config.
        </p>
      )}
    </ScrollArea>
  );
}
