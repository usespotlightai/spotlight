import { type SearchCandidate, searchChanges } from '@/lib/search';
import { NO_CHANGES, SEED_CHANGES } from '@/lib/search-words';
import { changePhrase } from '@/lib/station-config';

export function CandidateChanges({
  candidate,
}: {
  candidate: SearchCandidate;
}) {
  const changes = candidate.isSeed ? [] : searchChanges(candidate);

  if (changes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {candidate.isSeed ? SEED_CHANGES : NO_CHANGES}
      </p>
    );
  }

  return (
    <ul
      aria-label="What changed"
      className="flex flex-col gap-1 text-foreground text-sm"
    >
      {changes.map((change) => (
        <li key={`${change.part}:${change.name ?? ''}`}>
          {changePhrase(change)}
        </li>
      ))}
    </ul>
  );
}
