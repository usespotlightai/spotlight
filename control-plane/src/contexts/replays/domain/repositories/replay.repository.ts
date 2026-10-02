import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ReplayRepository {
  find(id: ReplayId): Promise<Replay | null>;

  ranAs(run: RunId): Promise<Replay | null>;

  ofSet(setId: ReplaySetId): Promise<readonly Replay[]>;

  ofCandidate(candidateId: CandidateId): Promise<readonly Replay[]>;

  teamsDispatching(): Promise<readonly TeamId[]>;

  underwayOfTeamLocked(teamId: TeamId): Promise<readonly Replay[]>;

  unconfirmed(): Promise<readonly Replay[]>;

  add(replay: Replay): Promise<void>;

  save(replay: Replay): Promise<void>;
}
