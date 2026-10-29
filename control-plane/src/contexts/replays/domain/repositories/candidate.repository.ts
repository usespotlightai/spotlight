import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface CandidateRepository {
  find(id: CandidateId): Promise<Candidate | null>;

  locked(id: CandidateId): Promise<Candidate | null>;

  findMany(ids: readonly CandidateId[]): Promise<readonly Candidate[]>;

  add(candidate: Candidate): Promise<void>;

  save(candidate: Candidate): Promise<void>;

  ofTeam(teamId: TeamId): Promise<readonly Candidate[]>;
}
