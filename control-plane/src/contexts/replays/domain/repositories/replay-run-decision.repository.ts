import type { ReplayRunDecision } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ReplayRunDecisionRepository {
  find(runId: RunId): Promise<ReplayRunDecision | null>;

  ofTeam(teamId: TeamId): Promise<readonly ReplayRunDecision[]>;

  ofReplay(replayId: ReplayId): Promise<readonly ReplayRunDecision[]>;

  ofDeletedReplays(
    decidedBefore: Date,
    limit: number,
  ): Promise<readonly ReplayRunDecision[]>;

  add(decision: ReplayRunDecision): Promise<void>;

  save(decision: ReplayRunDecision): Promise<void>;
}
