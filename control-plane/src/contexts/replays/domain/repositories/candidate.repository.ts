import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { CandidatePath } from '@replays/domain/value-objects/candidate-path.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface CandidateRepository {
  find(id: CandidateId): Promise<Candidate | null>;

  locked(id: CandidateId): Promise<Candidate | null>;

  lockedForUse(id: CandidateId): Promise<Candidate | null>;

  findMany(ids: readonly CandidateId[]): Promise<readonly Candidate[]>;

  proposedAt(teamId: TeamId, address: CandidatePath): Promise<Candidate | null>;

  add(candidate: Candidate): Promise<void>;

  save(candidate: Candidate): Promise<void>;

  ofTeam(teamId: TeamId): Promise<readonly Candidate[]>;

  ofTeams(teamIds: readonly TeamId[]): Promise<readonly Candidate[]>;
}
