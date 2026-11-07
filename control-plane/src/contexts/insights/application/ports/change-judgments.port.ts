import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { JudgingFailureCode } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import type { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const CHANGE_JUDGMENTS = Symbol('CHANGE_JUDGMENTS');

export interface ChangeJudgmentOrder {
  readonly runId: RunId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId | null;
  readonly guidanceRequested: boolean;
}

interface ChangeJudgmentReason {
  readonly text: string;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
  readonly claim: number | null;
}

export interface UnjudgedJudgment {
  readonly judged: false;
  readonly failure: JudgingFailureCode;
  readonly spent: ModelUsage;
}

export type ChangeJudgment =
  | {
      readonly judged: true;
      readonly value: number;
      readonly claimResults: readonly boolean[] | null;
      readonly reasons: readonly ChangeJudgmentReason[];
      readonly guidance: string | null;
      readonly referenced: boolean;
      readonly model: string;
      readonly spent: ModelUsage;
    }
  | UnjudgedJudgment;

export interface ChangeJudgmentsPort {
  readonly available: boolean;

  judge(order: ChangeJudgmentOrder): Promise<ChangeJudgment>;
}
