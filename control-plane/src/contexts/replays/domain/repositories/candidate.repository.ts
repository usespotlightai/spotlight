import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { CandidateAddress } from '@replays/domain/value-objects/candidate-address.vo';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { PossibleOrigin } from '@replays/domain/value-objects/config-origin.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface CandidateRepository {
  find(id: CandidateId): Promise<Candidate | null>;

  locked(id: CandidateId): Promise<Candidate | null>;

  lockedForUse(id: CandidateId): Promise<Candidate | null>;

  findMany(ids: readonly CandidateId[]): Promise<readonly Candidate[]>;

  proposedAt(
    teamId: TeamId,
    address: CandidateAddress,
  ): Promise<Candidate | null>;

  add(candidate: Candidate): Promise<void>;

  save(candidate: Candidate): Promise<void>;

  ofTeam(teamId: TeamId): Promise<readonly Candidate[]>;

  ofTeams(teamIds: readonly TeamId[]): Promise<readonly Candidate[]>;

  possibleOriginsAt(
    teamId: TeamId,
    stationIds: readonly string[],
  ): Promise<readonly PossibleOrigin[]>;

  removeWithdrawn(id: CandidateId): Promise<void>;

  removeWithdrawnOfTeam(teamId: TeamId): Promise<void>;

  removeWithdrawnAtStations(stationIds: readonly string[]): Promise<void>;
}
