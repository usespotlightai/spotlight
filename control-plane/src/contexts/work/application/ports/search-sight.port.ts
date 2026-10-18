export const SEARCH_SIGHT = Symbol('SEARCH_SIGHT');

export type SightedBlock = Readonly<Record<string, unknown>>;

interface SightedCandidateRun {
  readonly runId: string;
  readonly original: string;
  readonly repeat: number;
  readonly succeeded: boolean | null;
  readonly reasons: readonly string[];
  readonly verdict: string | null;
}

interface SightedCandidate {
  readonly name: string;
  readonly fingerprint: string;
  readonly hypothesis: string;
  readonly block: SightedBlock;
  readonly runs: readonly SightedCandidateRun[];
}

export interface SearchSight {
  readonly stationId: string;
  readonly heldOutTasks: readonly string[];
  readonly shownOriginals: readonly string[];
  readonly candidates: readonly SightedCandidate[];
  readonly seedBlock: SightedBlock;
}

export interface SearchSightPort {
  of(runId: string): Promise<SearchSight>;
}
