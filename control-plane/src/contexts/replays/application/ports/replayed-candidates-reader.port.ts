import type { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ScoredSearch } from '@replays/domain/services/search-scores';
import type { HealthCandidate } from '@replays/domain/services/set-health';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type {
  ConfigPullRequestCloseReason,
  ConfigPullRequestState,
} from '@replays/domain/value-objects/config-pull-request-state';
import type { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayOutcome } from '@replays/domain/value-objects/replay-outcome.vo';
import type { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type { SearchState } from '@replays/domain/value-objects/search-state';
import type { StationChange } from '@replays/domain/value-objects/station-changes.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const REPLAYED_CANDIDATES_READER = Symbol('REPLAYED_CANDIDATES_READER');

export interface ReplayedRow {
  readonly setId: ReplaySetId;
  readonly searchId: SearchId | null;
  readonly candidateId: CandidateId;
  readonly station: ReplayedStation;
}

export interface ReplayedSetRow {
  readonly id: ReplaySetId;
  readonly station: ReplayedStation;
  readonly isAtGoneStation: boolean;
  readonly entries: readonly ReplaySetEntry[];
  readonly runs: readonly RunId[];
}

export interface ReplayedProposalRow {
  readonly candidateId: CandidateId;
  readonly name: CandidateName;
  readonly replay: { readonly replayId: ReplayId };
}

export interface ReplayedSearchRow extends ScoredSearch {
  readonly id: SearchId;
  readonly station: ReplayedStation;
  readonly setId: ReplaySetId;
  readonly startedAt: Date;
  readonly current: SearchState;
  readonly objective: SearchObjective;
  readonly proposals: readonly ReplayedProposalRow[];
  readonly split: HeldOutSplit;
}

export interface ReplayedCandidateRow extends HealthCandidate {
  readonly hypothesis: Hypothesis | null;
  readonly changes: readonly StationChange[];
}

export interface ReplayedPullRequestRow {
  readonly id: ConfigPullRequestId;
  readonly searchId: SearchId;
  readonly candidateId: CandidateId;
  readonly current: ConfigPullRequestState;
  readonly closedBecause: ConfigPullRequestCloseReason | null;
  readonly closeFailure: ConfigPullRequestReason | null;
  readonly url: PullRequestUrl | null;
  readonly reason: ConfigPullRequestReason | null;
}

export interface ReplayedCandidatesReaderPort {
  startedOfTeamSince(
    teamId: TeamId,
    since: Date,
    max: number,
  ): Promise<readonly ReplayedRow[]>;

  sets(setIds: readonly ReplaySetId[]): Promise<readonly ReplayedSetRow[]>;

  searches(
    searchIds: readonly SearchId[],
  ): Promise<readonly ReplayedSearchRow[]>;

  searchesOfSetsStartedSince(
    setIds: readonly ReplaySetId[],
    since: Date,
  ): Promise<readonly ReplayedSearchRow[]>;

  outcomesOfSearches(
    searchIds: readonly SearchId[],
  ): Promise<readonly ReplayOutcome[]>;

  servingBaselinesOfSets(
    setIds: readonly ReplaySetId[],
  ): Promise<readonly ReplayOutcome[]>;

  healthSamplesOfSets(
    setIds: readonly ReplaySetId[],
    perGroup: number,
  ): Promise<readonly ReplayOutcome[]>;

  outcomes(replayIds: readonly ReplayId[]): Promise<readonly ReplayOutcome[]>;

  candidates(
    candidateIds: readonly CandidateId[],
  ): Promise<readonly ReplayedCandidateRow[]>;

  pullRequestsOfSearches(
    searchIds: readonly SearchId[],
  ): Promise<readonly ReplayedPullRequestRow[]>;
}
