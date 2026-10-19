export const SEARCH_VISIBILITY = Symbol('SEARCH_VISIBILITY');

export type VisibleBlock = Readonly<Record<string, unknown>>;

interface VisibleCandidateRun {
  readonly runId: string;
  readonly original: string;
  readonly repeat: number;
  readonly succeeded: boolean | null;
  readonly reasons: readonly string[];
  readonly verdict: string | null;
  readonly guidance: string | null;
}

interface VisibleCandidate {
  readonly name: string;
  readonly fingerprint: string;
  readonly hypothesis: string;
  readonly block: VisibleBlock;
  readonly runs: readonly VisibleCandidateRun[];
}

export interface SearchVisibility {
  readonly stationId: string;
  readonly heldOutTasks: readonly string[];
  readonly shownOriginals: readonly string[];
  readonly candidates: readonly VisibleCandidate[];
  readonly seedBlock: VisibleBlock;
}

export interface SearchVisibilityPort {
  of(runId: string): Promise<SearchVisibility>;
}
