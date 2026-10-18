import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INSIGHTS = Symbol('REPLAYS_INSIGHTS');

export interface JudgingOrder {
  readonly run: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly judge: JudgeCriteria;
  readonly reference: RunId | null;
}

export interface SideBySideJudgingOrder {
  readonly run: RunId;
  readonly other: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly judge: JudgeCriteria;
  readonly reference: RunId;
  readonly maxAttempts: number;
}

export type JudgingOrdered = 'requested' | 'unavailable' | 'unreadable-rubric';

export type JudgingAgainOrdered = 'requested' | 'unavailable' | 'unjudged';

export interface InsightsPort {
  acceptedAfter(run: RunId): Promise<boolean>;

  originalOutcomes(
    runs: readonly RunId[],
  ): Promise<ReadonlyMap<string, OriginalOutcome>>;

  judge(order: JudgingOrder): Promise<JudgingOrdered>;

  judgeAgain(run: RunId): Promise<JudgingAgainOrdered>;

  judgeSideBySide(order: SideBySideJudgingOrder): Promise<JudgingOrdered>;
}
