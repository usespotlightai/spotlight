import type { ReplayRunDecision } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ReplayRunDecisionRepository {
  find(runId: RunId): Promise<ReplayRunDecision | null>;

  ofTeam(teamId: TeamId): Promise<readonly ReplayRunDecision[]>;

  add(decision: ReplayRunDecision): Promise<void>;

  save(decision: ReplayRunDecision): Promise<void>;
}
