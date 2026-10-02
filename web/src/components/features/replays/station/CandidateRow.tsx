import { ConfigChanges } from '@/components/features/stations/ConfigChanges';
import { Fingerprint } from '@/components/shared/Fingerprint';
import { changesOf, type ReplayCandidate } from '@/lib/replay';
import { since } from '@/lib/runner';

type CandidateRowProps = {
  candidate: ReplayCandidate;
};

export function CandidateRow({ candidate }: CandidateRowProps) {
  const changes = changesOf(candidate);

  return (
    <li
      data-slot="candidate"
      className="flex flex-col gap-1 rounded-md px-2 py-2 text-sm"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 truncate font-medium text-foreground">
          {candidate.name}
        </span>
        <Fingerprint
          fingerprint={candidate.fingerprint}
          className="text-muted-foreground text-xs"
        />
        <span className="text-muted-foreground text-xs sm:ml-auto">
          Proposed {since(candidate.createdAt)}
        </span>
      </div>

      {changes.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs">
          <span className="text-muted-foreground">
            Changed from live{' '}
            <Fingerprint fingerprint={candidate.changedFrom.fingerprint} />:
          </span>
          <ConfigChanges changes={changes} />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          The same as the live config when it was proposed.
        </p>
      )}
    </li>
  );
}
