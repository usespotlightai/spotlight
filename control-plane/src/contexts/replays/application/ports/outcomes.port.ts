import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const OUTCOMES = Symbol('REPLAYS_OUTCOMES');

export interface JudgingOrder {
  readonly run: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly judge: JudgeCriteria;
  readonly reference: RunId | null;
}

export interface PairJudgingOrder {
  readonly run: RunId;
  readonly against: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly judge: JudgeCriteria;
  readonly reference: RunId;
  readonly maxAttempts: number;
}

export type JudgingOrdered = 'asked' | 'unavailable' | 'unreadable-rubric';

export type JudgingAgainOrdered = 'asked' | 'unavailable' | 'unjudged';

export interface OutcomesPort {
  acceptedAfter(run: RunId): Promise<boolean>;

  turnedOut(
    runs: readonly RunId[],
  ): Promise<ReadonlyMap<string, OriginalOutcome>>;

  judge(order: JudgingOrder): Promise<JudgingOrdered>;

  judgeAgain(run: RunId): Promise<JudgingAgainOrdered>;

  judgePair(order: PairJudgingOrder): Promise<JudgingOrdered>;
}
