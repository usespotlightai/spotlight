import type { ChangeJudgment } from '@replays/domain/value-objects/change-judgment';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const CHANGE_JUDGE = Symbol('REPLAYS_CHANGE_JUDGE');

export interface ChangeJudgeOrder {
  readonly workspaceId: string;
  readonly run: RunId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId | null;
  readonly guidanceRequested: boolean;
}

export interface ChangeJudgePort {
  availableTo(workspaceId: string): Promise<boolean>;

  judge(order: ChangeJudgeOrder): Promise<ChangeJudgment>;
}
