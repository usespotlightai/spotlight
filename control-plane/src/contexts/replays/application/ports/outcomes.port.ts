import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const OUTCOMES = Symbol('REPLAYS_OUTCOMES');

export interface JudgingOrder {
  readonly run: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly rubric: string;
  readonly reference: RunId | null;
}

export type JudgingOrdered = 'asked' | 'unavailable' | 'unreadable-rubric';

export type JudgingAgainOrdered = 'asked' | 'unavailable' | 'unjudged';

export interface OutcomesPort {
  acceptedAfter(run: RunId): Promise<boolean>;

  judge(order: JudgingOrder): Promise<JudgingOrdered>;

  judgeAgain(run: RunId): Promise<JudgingAgainOrdered>;
}
